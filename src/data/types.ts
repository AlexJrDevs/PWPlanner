export type ItemCategory = 'block' | 'background' | 'cosmetic' | 'prop'

export type CosmeticSlot =
    | 'hair'
    | 'hat'
    | 'Mask'
    | 'Hood'
    | 'Lense'
    | 'Accessorie'
    | 'Shirt'
    | 'Hoodie'
    | 'Outfit'
    | 'Dress'
    | 'Pants'
    | 'Tights'
    | 'Skirt'
    | 'Shoe'
    | 'Glove'
    | 'Weapon'
    | 'BackHandItem'
    | 'BackItem'
    | 'Familiars'
    | 'FlyingMount'
    | null

export interface Item {
  id: number
  name: string
  sprite: string
  category: ItemCategory
  cosmeticSlot?: CosmeticSlot
  stackable?: boolean
}
