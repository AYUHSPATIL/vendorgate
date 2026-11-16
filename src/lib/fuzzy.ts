export const NAME_PASS_THRESHOLD = 0.85
export const NAME_REVIEW_THRESHOLD = 0.5

const LEGAL_SUFFIXES = new Set([
  "pvt",
  "private",
  "ltd",
  "limited",
  "llc",
  "inc",
  "incorporated",
  "gmbh",
  "co",
  "corp",
  "corporation",
  "company",
  "plc",
  "llp",
])

export function normalizeName(value: string): string {
  const tokens = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1] ?? "")) {
    tokens.pop()
  }

  return tokens.join(" ")
}

export function levenshtein(left: string, right: string): number {
  if (left === right) return 0
  if (left.length === 0) return right.length
  if (right.length === 0) return left.length

  let previous = Array.from({ length: right.length + 1 }, (_, index) => index)
  let current = Array.from({ length: right.length + 1 }, () => 0)

  for (let i = 1; i <= left.length; i += 1) {
    current[0] = i
    const leftCode = left.charCodeAt(i - 1)
    for (let j = 1; j <= right.length; j += 1) {
      const cost = leftCode === right.charCodeAt(j - 1) ? 0 : 1
      const insert = (current[j - 1] ?? 0) + 1
      const remove = (previous[j] ?? 0) + 1
      const replace = (previous[j - 1] ?? 0) + cost
      current[j] = Math.min(insert, remove, replace)
    }
    const swap = previous
    previous = current
    current = swap
  }

  return previous[right.length] ?? 0
}

function tokenJaccard(left: string, right: string): number {
  const a = new Set(left.split(" ").filter(Boolean))
  const b = new Set(right.split(" ").filter(Boolean))
  if (a.size === 0 && b.size === 0) return 1
  let intersection = 0
  for (const token of a) {
    if (b.has(token)) intersection += 1
  }
  const union = a.size + b.size - intersection
  return union === 0 ? 1 : intersection / union
}

export interface NameComparison {
  normalizedCompany: string
  normalizedHolder: string
  jaccard: number
  levenshteinSimilarity: number
  score: number
}

export function compareNames(company: string, holder: string): NameComparison {
  const normalizedCompany = normalizeName(company)
  const normalizedHolder = normalizeName(holder)
  const jaccard = tokenJaccard(normalizedCompany, normalizedHolder)
  const maxLength = Math.max(normalizedCompany.length, normalizedHolder.length)
  const levenshteinSimilarity =
    maxLength === 0 ? 1 : 1 - levenshtein(normalizedCompany, normalizedHolder) / maxLength
  return {
    normalizedCompany,
    normalizedHolder,
    jaccard,
    levenshteinSimilarity,
    score: (jaccard + levenshteinSimilarity) / 2,
  }
}
