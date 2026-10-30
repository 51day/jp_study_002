import React from 'react';
import { parseFurigana } from '../services/japaneseHelper';

interface JapaneseRubyTextProps {
  text: string;
  reading?: string | null;
  className?: string;
  rubyClassName?: string;
}

export const JapaneseRubyText: React.FC<JapaneseRubyTextProps> = ({
  text,
  reading,
  className = '',
  rubyClassName = 'text-xs text-indigo-500 font-semibold select-none',
}) => {
  const tokens = parseFurigana(text, reading);

  if (tokens.length === 1 && !tokens[0].furigana) {
    return <span className={className}>{tokens[0].kanji}</span>;
  }

  return (
    <span className={`inline-flex items-baseline flex-wrap ${className}`}>
      {tokens.map((token, idx) => {
        if (!token.furigana) {
          return <span key={idx}>{token.kanji}</span>;
        }
        return (
          <ruby key={idx} className="inline-flex flex-col items-center">
            <rt className={rubyClassName}>{token.furigana}</rt>
            <span>{token.kanji}</span>
          </ruby>
        );
      })}
    </span>
  );
};
