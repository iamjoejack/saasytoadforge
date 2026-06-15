export interface Plan {
  id: string
  name: string
  priceUsd: number
  interval: 'month'
  blurb: string
  features: string[]
}

export interface CheckoutResult {
  url: string
  mode: 'mock' | 'stripe'
}
