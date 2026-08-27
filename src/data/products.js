const products = [
  {
    id: "dress-001",
    name: "Satin Midi Dress",
    slug: "satin-midi-dress",
    brand: "Élan",
    category: "Dresses",
    price: 32500,
    isNew: true,
    images: [
      "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
      "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
      "https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&q=80",
    ],
    variants: [
      {
        colour: "Burgundy",
        hex: "#722F37",
        image: "https://images.unsplash.com/photo-1595777457583-95e059d581b8?w=800&q=80",
        sizes: { XS: 2, S: 5, M: 8, L: 3, XL: 1 },
      },
      {
        colour: "Black",
        hex: "#1A1A1A",
        image: "https://images.unsplash.com/photo-1566174053879-31528523f8ae?w=800&q=80",
        sizes: { XS: 0, S: 4, M: 7, L: 2, XL: 0 },
      },
    ],
  },
  {
    id: "top-001",
    name: "Silk Wrap Blouse",
    slug: "silk-wrap-blouse",
    brand: "Maison Noir",
    category: "Tops",
    price: 18500,
    isNew: true,
    images: [
      "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&q=80",
      "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
    ],
    variants: [
      {
        colour: "Ivory",
        hex: "#FFFFF0",
        image: "https://images.unsplash.com/photo-1485968579580-b6d095142e6e?w=800&q=80",
        sizes: { XS: 3, S: 6, M: 10, L: 4, XL: 2 },
      },
      {
        colour: "Dusty Rose",
        hex: "#DCAE96",
        image: "https://images.unsplash.com/photo-1509631179647-0177331693ae?w=800&q=80",
        sizes: { XS: 1, S: 3, M: 5, L: 2, XL: 0 },
      },
    ],
  },
  {
    id: "trouser-001",
    name: "High-Waist Wide Leg Trousers",
    slug: "high-waist-wide-leg-trousers",
    brand: "Élan",
    category: "Trousers",
    price: 24000,
    isNew: false,
    images: [
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
      "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80",
    ],
    variants: [
      {
        colour: "Camel",
        hex: "#C19A6B",
        image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
        sizes: { XS: 0, S: 4, M: 6, L: 5, XL: 3 },
      },
      {
        colour: "Black",
        hex: "#1A1A1A",
        image: "https://images.unsplash.com/photo-1506629082955-511b1aa562c8?w=800&q=80",
        sizes: { XS: 2, S: 7, M: 9, L: 4, XL: 1 },
      },
    ],
  },
  {
    id: "dress-002",
    name: "Linen Shirt Dress",
    slug: "linen-shirt-dress",
    brand: "Terre",
    category: "Dresses",
    price: 27000,
    isNew: true,
    images: [
      "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80",
      "https://images.unsplash.com/photo-1502716119720-b23a1e3b2b22?w=800&q=80",
    ],
    variants: [
      {
        colour: "Oat",
        hex: "#D4C5A9",
        image: "https://images.unsplash.com/photo-1496747611176-843222e1e57c?w=800&q=80",
        sizes: { XS: 4, S: 8, M: 12, L: 6, XL: 3 },
      },
      {
        colour: "Sage",
        hex: "#9CAF88",
        image: "https://images.unsplash.com/photo-1502716119720-b23a1e3b2b22?w=800&q=80",
        sizes: { XS: 2, S: 5, M: 7, L: 3, XL: 1 },
      },
    ],
  },
  {
    id: "top-002",
    name: "Ribbed Knit Tank",
    slug: "ribbed-knit-tank",
    brand: "Maison Noir",
    category: "Tops",
    price: 9500,
    isNew: false,
    images: [
      "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
    ],
    variants: [
      {
        colour: "White",
        hex: "#FAFAFA",
        image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
        sizes: { XS: 5, S: 10, M: 15, L: 8, XL: 4 },
      },
      {
        colour: "Black",
        hex: "#1A1A1A",
        image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
        sizes: { XS: 3, S: 8, M: 12, L: 6, XL: 2 },
      },
      {
        colour: "Taupe",
        hex: "#B8A99A",
        image: "https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&q=80",
        sizes: { XS: 2, S: 5, M: 9, L: 4, XL: 1 },
      },
    ],
  },
  {
    id: "dress-003",
    name: "Pleated Maxi Skirt",
    slug: "pleated-maxi-skirt",
    brand: "Terre",
    category: "Skirts",
    price: 21000,
    isNew: false,
    images: [
      "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&q=80",
      "https://images.unsplash.com/photo-1551163943-3f6a855d1153?w=800&q=80",
    ],
    variants: [
      {
        colour: "Champagne",
        hex: "#F7E7CE",
        image: "https://images.unsplash.com/photo-1583496661160-fb5886a0aaaa?w=800&q=80",
        sizes: { XS: 3, S: 6, M: 8, L: 4, XL: 2 },
      },
    ],
  },
  {
    id: "top-003",
    name: "Oversized Blazer",
    slug: "oversized-blazer",
    brand: "Élan",
    category: "Outerwear",
    price: 38000,
    isNew: true,
    images: [
      "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
      "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
    ],
    variants: [
      {
        colour: "Charcoal",
        hex: "#36454F",
        image: "https://images.unsplash.com/photo-1591047139829-d91aecb6caea?w=800&q=80",
        sizes: { XS: 1, S: 3, M: 5, L: 3, XL: 2 },
      },
      {
        colour: "Camel",
        hex: "#C19A6B",
        image: "https://images.unsplash.com/photo-1594938298603-c8148c4dae35?w=800&q=80",
        sizes: { XS: 2, S: 4, M: 6, L: 3, XL: 1 },
      },
    ],
  },
  {
    id: "dress-004",
    name: "Off-Shoulder Bodycon",
    slug: "off-shoulder-bodycon",
    brand: "Maison Noir",
    category: "Dresses",
    price: 19500,
    isNew: false,
    images: [
      "https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=800&q=80",
    ],
    variants: [
      {
        colour: "Black",
        hex: "#1A1A1A",
        image: "https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=800&q=80",
        sizes: { XS: 4, S: 8, M: 10, L: 5, XL: 2 },
      },
      {
        colour: "Wine",
        hex: "#722F37",
        image: "https://images.unsplash.com/photo-1518577915332-c2a19f149a75?w=800&q=80",
        sizes: { XS: 2, S: 5, M: 7, L: 3, XL: 1 },
      },
    ],
  },
]

export default products
