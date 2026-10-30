/**
 * Dual-Engine Text-to-Speech (TTS) Service
 * 全网成熟方案：在线真人发音 + 本机 Web Speech API 离线后备双引擎
 * 支持：
 * 1. 在线优先 (Online First - 有道词典真人原声 / Google TTS 备用，失败自动回退本机)
 * 2. 纯本机语音 (Local Only - Web Speech API 离线运行)
 * 3. 纯在线音频 (Online Only)
 * 4. 针对日语汉字读音优化：若提供假名 reading，自动采用假名发音，避免日语多音字错误读法 (如 辛い / 行く 等)
 */
import { Language, AudioSource, EnAccent } from '../types';

class TtsService {
  private synth: SpeechSynthesis | null = null;
  private voices: SpeechSynthesisVoice[] = [];
  private currentAudio: HTMLAudioElement | null = null;
  private audioCache = new Map<string, HTMLAudioElement>();
  private audioSource: AudioSource = 'online_first';
  private enAccent: EnAccent = 'us';
  private lastUsedSource: 'online' | 'local' | 'none' = 'none';

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  public setAudioSource(source: AudioSource) {
    this.audioSource = source;
  }

  public getAudioSource(): AudioSource {
    return this.audioSource;
  }

  public setEnAccent(accent: EnAccent) {
    this.enAccent = accent;
  }

  public getEnAccent(): EnAccent {
    return this.enAccent;
  }

  public getLastUsedSource(): 'online' | 'local' | 'none' {
    return this.lastUsedSource;
  }

  private loadVoices() {
    if (!this.synth) return;
    this.voices = this.synth.getVoices();
  }

  /**
   * Main speak method
   * @param text The word or sentence to pronounce
   * @param language 'en' | 'ja'
   * @param rate playback rate 0.5 - 1.5
   * @param reading optional kana reading for Japanese kanji words
   */
  public async speak(
    text: string,
    language: Language = 'en',
    rate: number = 1.0,
    reading?: string | null
  ): Promise<void> {
    if (!text || !text.trim()) return;

    this.stop();

    // Japanese pronunciation optimization:
    // If text contains Kanji and we have a kana reading, use the kana for TTS to avoid misreading!
    let pronounceText = text.trim();
    if (language === 'ja' && reading && reading.trim()) {
      // Check if original text has kanji
      const hasKanji = /[\u4e00-\u9faf]/.test(text);
      if (hasKanji) {
        // Strip out brackets if any
        pronounceText = reading.trim().replace(/[\[\]\(\)]/g, '');
      }
    }

    if (this.audioSource === 'local_only') {
      await this.speakLocal(pronounceText, language, rate);
      this.lastUsedSource = 'local';
      return;
    }

    if (this.audioSource === 'online_only') {
      const ok = await this.speakOnline(pronounceText, language, rate);
      this.lastUsedSource = ok ? 'online' : 'none';
      return;
    }

    // Default: online_first (Try online audio first, fall back to local)
    const onlineSuccess = await this.speakOnline(pronounceText, language, rate);
    if (onlineSuccess) {
      this.lastUsedSource = 'online';
    } else {
      await this.speakLocal(pronounceText, language, rate);
      this.lastUsedSource = 'local';
    }
  }

  /**
   * Play online audio with high quality native voice
   */
  private speakOnline(text: string, language: Language, rate: number): Promise<boolean> {
    return new Promise((resolve) => {
      // Generate online audio URLs
      let primaryUrl = '';
      let fallbackUrl = '';

      const cleanText = encodeURIComponent(text.trim());

      if (language === 'ja') {
        // Youdao Japanese audio
        primaryUrl = `https://dict.youdao.com/dictvoice?audio=${cleanText}&le=jap`;
        fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=${cleanText}`;
      } else {
        // Youdao English audio: type=1 (UK), type=2 (US)
        const typeParam = this.enAccent === 'uk' ? 1 : 2;
        primaryUrl = `https://dict.youdao.com/dictvoice?audio=${cleanText}&type=${typeParam}`;
        fallbackUrl = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${cleanText}`;
      }

      const cacheKey = `${language}_${primaryUrl}`;
      let audio = this.audioCache.get(cacheKey);

      if (!audio) {
        audio = new Audio(primaryUrl);
        this.audioCache.set(cacheKey, audio);
      }

      this.currentAudio = audio;
      audio.playbackRate = Math.max(0.6, Math.min(1.4, rate));

      let resolved = false;

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          // Try fallback URL if primary hangs or network is slow
          this.tryFallbackAudio(fallbackUrl, rate).then(resolve);
        }
      }, 2500);

      audio.onended = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          resolve(true);
        }
      };

      audio.onerror = () => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.tryFallbackAudio(fallbackUrl, rate).then(resolve);
        }
      };

      audio.play().catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timer);
          this.tryFallbackAudio(fallbackUrl, rate).then(resolve);
        }
      });
    });
  }

  private tryFallbackAudio(url: string, rate: number): Promise<boolean> {
    return new Promise((resolve) => {
      if (!url) {
        resolve(false);
        return;
      }
      const audio = new Audio(url);
      this.currentAudio = audio;
      audio.playbackRate = Math.max(0.6, Math.min(1.4, rate));

      const timer = setTimeout(() => {
        resolve(false);
      }, 2000);

      audio.onended = () => {
        clearTimeout(timer);
        resolve(true);
      };
      audio.onerror = () => {
        clearTimeout(timer);
        resolve(false);
      };
      audio.play().catch(() => {
        clearTimeout(timer);
        resolve(false);
      });
    });
  }

  /**
   * Local Speech Synthesis using Web Speech API
   */
  private speakLocal(text: string, language: Language, rate: number): Promise<void> {
    return new Promise((resolve) => {
      if (!this.synth || !text) {
        resolve();
        return;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = Math.max(0.6, Math.min(1.5, rate));
      utterance.pitch = 1.0;

      const targetLang = language === 'ja' ? 'ja' : 'en';
      utterance.lang = language === 'ja' ? 'ja-JP' : (this.enAccent === 'uk' ? 'en-GB' : 'en-US');

      if (this.voices.length > 0) {
        const preferredVoice =
          this.voices.find(
            (v) =>
              v.lang.toLowerCase().startsWith(targetLang) &&
              (v.name.includes('Natural') ||
                v.name.includes('Enhanced') ||
                v.name.includes('Google') ||
                v.name.includes('Otoya') ||
                v.name.includes('Kyoko') ||
                v.name.includes('Siri'))
          ) || this.voices.find((v) => v.lang.toLowerCase().startsWith(targetLang));

        if (preferredVoice) {
          utterance.voice = preferredVoice;
        }
      }

      utterance.onend = () => resolve();
      utterance.onerror = () => resolve();

      this.synth.speak(utterance);
    });
  }

  public stop() {
    if (this.currentAudio) {
      try {
        this.currentAudio.pause();
        this.currentAudio.currentTime = 0;
      } catch (_) {}
      this.currentAudio = null;
    }
    if (this.synth) {
      this.synth.cancel();
    }
  }
}

export const tts = new TtsService();
