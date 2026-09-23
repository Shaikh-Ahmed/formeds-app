export interface BaseFeedPost {
  id: string;
  author_id: string | null;
  author_name: string;
  author_role: string;
  content: string;
  image_url?: string;
  likes: string[];
  like_count: number;
  comment_count: number;
  created_at: string;
}

export interface UserFeedPost extends BaseFeedPost {
  post_type: 'text' | 'media';
}

export interface ArticleFeedPost extends BaseFeedPost {
  post_type: 'article';
  article_id: string; // e.g. "pubmed:42768901" or "openalex:W7134924725"
  article_source: 'pubmed' | 'openalex';
  article_url: string; // External DOI / PubMed URL
  journal: string; // Journal name
  authors: string; // e.g. "Smith J, Doe A"
  abstract: string; // Paper abstract / summary
  keywords: string[]; // Array of topic tags
  cited_by: number | null;
}

export type FeedItem = UserFeedPost | ArticleFeedPost;
