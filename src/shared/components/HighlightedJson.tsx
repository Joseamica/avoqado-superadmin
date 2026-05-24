import { Fragment, type ReactNode } from 'react'
import { cn } from '@/shared/lib/utils'

/**
 * Renderiza un JSON pretty-printed con syntax highlighting usando los tokens
 * de color del design system (accent para keys, success para strings, warn
 * para literales numéricos/booleanos/null). Sin dependencias externas — un
 * regex separa los tokens del `JSON.stringify` pretty.
 *
 * Usado en system-logs/LogDetail para que las cargas JSON sean escaneables
 * de un vistazo en lugar de wall-of-text monocromo.
 */

interface HighlightedJsonProps {
  value: unknown
  className?: string
}

type Token =
  | { type: 'key'; value: string }
  | { type: 'string'; value: string }
  | { type: 'literal'; value: string }
  | { type: 'number'; value: string }
  | { type: 'text'; value: string }

// Match en este orden:
//   1. Keys con dos puntos: `"foo":`
//   2. Strings: `"bar"`
//   3. true / false / null
//   4. Números (incluye decimales y exponentes)
const TOKEN_REGEX =
  /("(?:\\.|[^"\\])*")\s*:|("(?:\\.|[^"\\])*")|(\btrue\b|\bfalse\b|\bnull\b)|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g

function tokenize(input: string): Token[] {
  const tokens: Token[] = []
  let lastIndex = 0
  for (const match of input.matchAll(TOKEN_REGEX)) {
    const index = match.index ?? 0
    if (index > lastIndex) {
      tokens.push({ type: 'text', value: input.slice(lastIndex, index) })
    }
    if (match[1] !== undefined) tokens.push({ type: 'key', value: match[1] })
    else if (match[2] !== undefined) tokens.push({ type: 'string', value: match[2] })
    else if (match[3] !== undefined) tokens.push({ type: 'literal', value: match[3] })
    else if (match[4] !== undefined) tokens.push({ type: 'number', value: match[4] })
    lastIndex = index + match[0].length
    // El `:` post-key NO está dentro del grupo 1 — lo añadimos como text
    if (match[1] !== undefined) {
      // Encontrar el `:` y todo el whitespace antes de él
      const colonIdx = input.indexOf(':', index + match[1].length)
      if (colonIdx >= 0) {
        tokens.push({ type: 'text', value: input.slice(index + match[1].length, colonIdx + 1) })
        lastIndex = colonIdx + 1
      }
    }
  }
  if (lastIndex < input.length) {
    tokens.push({ type: 'text', value: input.slice(lastIndex) })
  }
  return tokens
}

function renderToken(token: Token, index: number): ReactNode {
  switch (token.type) {
    case 'key':
      return (
        <span key={index} className="font-semibold text-[var(--accent)]">
          {token.value}
        </span>
      )
    case 'string':
      return (
        <span key={index} className="text-[var(--success)]">
          {token.value}
        </span>
      )
    case 'literal':
      return (
        <span key={index} className="text-[var(--warn)]">
          {token.value}
        </span>
      )
    case 'number':
      return (
        <span key={index} className="text-[var(--warn)]">
          {token.value}
        </span>
      )
    case 'text':
      return (
        <Fragment key={index}>
          <span className="text-[var(--ink-muted)]">{token.value}</span>
        </Fragment>
      )
  }
}

export function HighlightedJson({ value, className }: HighlightedJsonProps) {
  let pretty: string
  try {
    pretty = JSON.stringify(value, null, 2)
  } catch {
    pretty = String(value)
  }

  const tokens = tokenize(pretty)

  return (
    <pre
      className={cn(
        'overflow-x-auto whitespace-pre rounded-[4px] border border-[var(--line)] bg-[var(--canvas)] p-3 font-mono text-[12px] leading-relaxed',
        className,
      )}
    >
      {tokens.map(renderToken)}
    </pre>
  )
}
