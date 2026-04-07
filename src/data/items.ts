import { items } from './generated/sprites'
export { items }

export type { ItemCategory, CosmeticSlot, Item } from './types'

import type { Item, ItemCategory, CosmeticSlot } from './types'

export const getItemById = (id: number): Item | undefined =>
  items.find(item => item.id === id)

export const getItemsByCategory = (category: ItemCategory): Item[] =>
  items.filter(item => item.category === category)

export const getItemsBySlot = (slot: CosmeticSlot): Item[] =>
  items.filter(item => item.cosmeticSlot === slot)