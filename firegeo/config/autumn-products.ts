export interface AutumnProduct {
  id: string;
  name: string;
  description?: string;
  type: 'service' | 'physical' | 'addon';
  display?: {
    name?: string;
    description?: string;
    recommend_text?: string;
    button_text?: string;
    button_url?: string;
    everything_from?: string;
  };
  properties?: {
    interval?: 'month' | 'year' | 'one_time';
    interval_group?: 'month' | 'year';
    is_free?: boolean;
  };
  items: Array<{
    id: string;
    type: 'flat' | 'unit' | 'tier';
    display?: {
      primary_text?: string;
      secondary_text?: string;
    };
    flat?: {
      amount: number;
    };
    unit?: {
      amount: number;
      quantity?: number;
    };
  }>;
}

export const AUTUMN_PRODUCTS: AutumnProduct[] = [
  {
    id: 'free',
    name: 'Free',
    description: 'Get started with basic features',
    type: 'service',
    display: {
      name: 'Free',
      description: 'Perfect for trying out our service',
      button_text: 'Get Started',
    },
    properties: {
      is_free: true,
    },
    items: [
      {
        id: 'free-messages',
        type: 'unit',
        display: {
          primary_text: '100 messages',
          secondary_text: 'per month',
        },
        unit: {
          amount: 0,
          quantity: 100,
        },
      },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    description: 'For growing teams that need more power',
    type: 'service',
    display: {
      name: 'Pro',
      description: 'Unlock full potential',
      button_text: 'Start Free Trial',
      recommend_text: 'Most Popular',
    },
    properties: {
      interval: 'month',
      interval_group: 'month',
    },
    items: [
      {
        id: 'pro-price',
        type: 'flat',
        display: {
          primary_text: '$9.99',
          secondary_text: 'per month',
        },
        flat: {
          amount: 999, // Amount in cents
        },
      },
      {
        id: 'pro-messages',
        type: 'unit',
        display: {
          primary_text: '10,000 messages',
          secondary_text: 'per month',
        },
        unit: {
          amount: 0,
          quantity: 10000,
        },
      },
    ],
  },
];

export const AUTUMN_ADDONS: AutumnProduct[] = [];