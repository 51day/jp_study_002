/**
 * Japanese Language Processing Helper
 * 全网成熟方案：振假名 (Ruby/Furigana) 智能解析、音调 (Pitch Accent) 标注、
 * 以及听写答题时的假名/平假名/片假名/罗马字模糊归一化比对
 */

export interface RubyToken {
  kanji: string;
  furigana?: string;
}

/**
 * Parses Japanese text with optional furigana notation or separate reading field
 * Supported formats:
 * - 漢字[かんじ]
 * - 漢字(かんじ)
 * - 漢字（かんじ）
 * - Or headword + separate reading field
 */
export function parseFurigana(text: string, reading?: string | null): RubyToken[] {
  if (!text) return [];

  // 1. Check if text already has bracket annotations e.g. 散歩[さんぽ] or 食べる[たべる]
  const bracketRegex = /([\u4e00-\u9faf]+)[\[\(（]([^\u4e00-\u9faf\[\]\(\)（）]+)[\]\)）]/g;
  if (bracketRegex.test(text)) {
    const tokens: RubyToken[] = [];
    let lastIndex = 0;
    // reset regex index
    bracketRegex.lastIndex = 0;
    let match;

    while ((match = bracketRegex.exec(text)) !== null) {
      // Text before match
      if (match.index > lastIndex) {
        tokens.push({ kanji: text.slice(lastIndex, match.index) });
      }
      tokens.push({
        kanji: match[1],
        furigana: match[2],
      });
      lastIndex = bracketRegex.lastIndex;
    }

    if (lastIndex < text.length) {
      tokens.push({ kanji: text.slice(lastIndex) });
    }
    return tokens;
  }

  // 2. If no brackets, but headword has Kanji and reading is provided
  const hasKanji = /[\u4e00-\u9faf]/.test(text);
  if (hasKanji && reading && reading.trim() && reading.trim() !== text.trim()) {
    return [
      {
        kanji: text.trim(),
        furigana: reading.trim(),
      },
    ];
  }

  // 3. Fallback: plain text
  return [{ kanji: text }];
}

/**
 * Convert Katakana to Hiragana
 */
export function katakanaToHiragana(str: string): string {
  return str.replace(/[\u30a1-\u30f6]/g, (match) => {
    const chr = match.charCodeAt(0) - 0x60;
    return String.fromCharCode(chr);
  });
}

/**
 * Basic Romaji to Hiragana conversion for common inputs
 */
const ROMAJI_TO_HIRAGANA: Record<string, string> = {
  a: 'あ', i: 'い', u: 'う', e: 'え', o: 'お',
  ka: 'か', ki: 'き', ku: 'く', ke: 'け', ko: 'こ',
  sa: 'さ', shi: 'し', si: 'し', su: 'す', se: 'せ', so: 'そ',
  ta: 'た', chi: 'ち', ti: 'ち', tsu: 'つ', tu: 'つ', te: 'て', to: 'と',
  na: 'な', ni: 'に', nu: 'ぬ', ne: 'ね', no: 'の',
  ha: 'は', hi: 'ひ', fu: 'ふ', hu: 'ふ', he: 'へ', ho: 'ほ',
  ma: 'ま', mi: 'み', mu: 'む', me: 'め', mo: 'も',
  ya: 'や', yu: 'ゆ', yo: 'よ',
  ra: 'ら', ri: 'り', ru: 'る', re: 'れ', ro: 'ろ',
  wa: 'わ', wo: 'を', n: 'ん', nn: 'ん',
  ga: 'が', gi: 'ぎ', gu: 'ぐ', ge: 'げ', go: 'ご',
  za: 'ざ', ji: 'じ', zi: 'じ', zu: 'ず', ze: 'ぜ', zo: 'ぞ',
  da: 'だ', di: 'ぢ', du: 'づ', de: 'で', do: 'ど',
  ba: 'ば', bi: 'び', bu: 'ぶ', be: 'べ', bo: 'ぼ',
  pa: 'ぱ', pi: 'ぴ', pu: 'ぷ', pe: 'ぺ', po: 'ぽ',
  kya: 'きゃ', kyu: 'きゅ', kyo: 'きょ',
  sha: 'しゃ', shu: 'しゅ', sho: 'しょ',
  cha: 'ちゃ', chu: 'ちゅ', cho: 'ちょ',
  nya: 'にゃ', nyu: 'にゅ', nyo: 'にょ',
  hya: 'ひゃ', hyu: 'ひゅ', hyo: 'ひょ',
  mya: 'みゃ', myu: 'みゅ', myo: 'みょ',
  rya: 'りゃ', ryu: 'りゅ', ryo: 'りょ',
  gya: 'ぎゃ', gyu: 'ぎゅ', gyo: 'ぎょ',
  ja: 'じゃ', ju: 'じゅ', jo: 'じょ',
  bya: 'びゃ', byu: 'びゅ', byo: 'びょ',
  pya: 'ぴゃ', pyu: 'ぴゅ', pyo: 'ぴょ',
};

export function romajiToHiragana(romaji: string): string {
  let result = romaji.toLowerCase().trim();
  // Sort keys by length descending to replace multi-char patterns first
  const keys = Object.keys(ROMAJI_TO_HIRAGANA).sort((a, b) => b.length - a.length);
  for (const k of keys) {
    result = result.replaceAll(k, ROMAJI_TO_HIRAGANA[k]);
  }
  return result;
}

/**
 * Fuzzy Japanese answer validation
 * Returns true if input matches headword, kana reading, katakana-to-hiragana equivalent, or romaji
 */
export function normalizeAndCompareJapanese(
  input: string,
  targetHeadword: string,
  reading?: string | null
): boolean {
  const cleanInput = input.trim().toLowerCase();
  const cleanHeadword = targetHeadword.trim().toLowerCase();
  const cleanReading = reading ? reading.trim().toLowerCase() : '';

  if (!cleanInput) return false;

  // Direct match with headword
  if (cleanInput === cleanHeadword) return true;

  // Direct match with reading
  if (cleanReading && cleanInput === cleanReading) return true;

  // Match with stripped brackets from headword
  const strippedHeadword = cleanHeadword.replace(/[\[\(（][^\]\)）]+[\]\)）]/g, '');
  if (cleanInput === strippedHeadword) return true;

  // Convert input Katakana to Hiragana
  const inputAsHira = katakanaToHiragana(cleanInput);
  const headwordAsHira = katakanaToHiragana(cleanHeadword);
  const readingAsHira = katakanaToHiragana(cleanReading);

  if (inputAsHira === headwordAsHira || (readingAsHira && inputAsHira === readingAsHira)) {
    return true;
  }

  // Romaji match
  const inputRomajiAsHira = romajiToHiragana(cleanInput);
  if (inputRomajiAsHira === headwordAsHira || (readingAsHira && inputRomajiAsHira === readingAsHira)) {
    return true;
  }

  return false;
}

/**
 * Format pitch accent type label
 */
export function getPitchAccentLabel(pitch: string | number | undefined | null): string {
  if (pitch === undefined || pitch === null || pitch === '') return '';
  const num = Number(pitch);
  if (isNaN(num)) return String(pitch);
  switch (num) {
    case 0:
      return '⓪ 平板型';
    case 1:
      return '① 头高型';
    case 2:
      return '② 中高型';
    case 3:
      return '③ 尾高型';
    default:
      return `[${num}] 高音型`;
  }
}
