export type ItemCategory = 'block' | 'background' | 'prop' | 'wearable' | 'weapon' | 'character' | 'none' | 'unknown'

export interface Item {
  id: number 
  block_name: string
  category: ItemCategory
  atlas: string
  x: number
  y: number
  w: number
  h: number
}