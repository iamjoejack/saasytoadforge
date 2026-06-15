export interface Plan {
  id: string
  name: string
  priceUsd: number
  interval: 'month' | 'one-time'
  blurb: string
  features: string[]
}

export interface CheckoutResult {
  url: string
  mode: 'mock' | 'stripe'
}
