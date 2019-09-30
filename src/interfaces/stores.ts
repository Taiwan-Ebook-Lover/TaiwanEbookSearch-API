export interface Book {
  id?: string;
  thumbnail?: string;
  title: string;
  link: string;
  priceCurrency?: string;
  price?: number;
  about?: string;
  publisher?: string;
  publishDate?: string;
  authors?: string[];
  nonDrmPrice?: number;
  translator?: string;
  translators?: string[];
  painters?: string[];
}
