import manifestRaw from './generated/manifest.json'
import type { Item, ItemCategory } from './types'

export type { Item, ItemCategory } from './types'

const manifestJson = Array.isArray(manifestRaw) ? manifestRaw : (manifestRaw as any).default ?? manifestRaw
export const items = manifestJson as Item[]

// O(1) indexes built once at startup
const byId = new Map<number, Item>(items.map(item => [Number(item.id), item]))
const byCategory = new Map<ItemCategory, Item[]>()

for (const item of items) {
  const bucket = byCategory.get(item.category) ?? []
  bucket.push(item)
  byCategory.set(item.category, bucket)
}

export const getItemById = (id: number): Item | undefined => byId.get(id)
export const getItemsByCategory = (category: ItemCategory): Item[] =>
  byCategory.get(category) ?? []