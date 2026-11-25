

export type Listing = { id: number; type: string; title: string; description: string; price: number; priceBasis: string; availability: string; condition?: 'new' | 'like_new' | 'good' | 'fair' | null;
  handoffNote?: string; stockQuantity?: number | null; category: { name: string }; campus: { code: string; name: string }; seller: { id: number; storeName: string; avatarUrl?: string | null; rating?: { average: number; count: number } | null }; images: string[]; status?: string };
