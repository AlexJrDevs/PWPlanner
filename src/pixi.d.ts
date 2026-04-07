import { PixiElements } from '@pixi/react'

declare global {
  namespace JSX {
    interface IntrinsicElements extends PixiElements {}
  }
}