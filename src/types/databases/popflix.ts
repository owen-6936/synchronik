// popflix-synchron/src/types/tables/table.types.ts

// ----------------------------------------------------------------------
// 1. TitleBasics (The Core IMDb Data Table)
// ----------------------------------------------------------------------

/**
 * Represents a single row from the TitleBasics table (title.basics.tsv.gz).
 */
export interface TitleBasic {
  tconst: string; // alphanumeric unique identifier of the title (IMDb ID)
  titleType: string; // e.g. movie, short, tvSeries, tvepisode, video
  primaryTitle: string; // The more popular title
  originalTitle: string; // Original title, in the original language
  isAdult: boolean; // 0: non-adult title; 1: adult title
  startYear: number | null; // Release year (YYYY)
  endYear: number | null; // TV Series end year
  runtimeMinutes: number | null; // Primary runtime in minutes
  genres: string | null; // Comma-separated list of genres (e.g., "Action,Comedy,Drama")
}

// ----------------------------------------------------------------------
// 2. TitleRatings (Rating Data Table)
// ----------------------------------------------------------------------

/**
 * Represents a single row from the TitleRatings table (title.ratings.tsv.gz).
 */
export interface TitleRating {
  tconst: string; // IMDb ID (Foreign Key to TitleBasics)
  averageRating: number; // Weighted average of all user ratings
  numVotes: number; // Total number of votes received
}

// ----------------------------------------------------------------------
// 3. TitleCrew (Director and Writer Data Table)
// ----------------------------------------------------------------------

/**
 * Represents a single row from the TitleCrew table (title.crew.tsv.gz).
 */
export interface TitleCrew {
  tconst: string; // IMDb ID (Foreign Key to TitleBasics)
  directors: string | null; // Comma-separated list of nconsts (person IDs)
  writers: string | null; // Comma-separated list of nconsts (person IDs)
}

// ----------------------------------------------------------------------
// 4. NameBasics (Cast and Crew Details Table)
// ----------------------------------------------------------------------

/**
 * Represents a single row from the NameBasics table (name.basics.tsv.gz).
 */
export interface NameBasic {
  nconst: string; // alphanumeric unique identifier of the name/person (IMDb Person ID)
  primaryName: string; // Name of the person
  birthYear: number | null; // Year of birth
  deathYear: number | null; // Year of death, if applicable
  primaryProfession: string | null; // Comma-separated list of professions
  knownForTitles: string | null; // Comma-separated list of tconsts (IMDb IDs)
}

// ----------------------------------------------------------------------
// 5. MediaLinks (The Enriched Data Table for Posters/Trailers)
// ----------------------------------------------------------------------

/**
 * Represents a single row from the MediaLinks table (now tracking local files).
 */
export interface MediaLink {
  imdb_id: string;
  tmdb_id: number | null;
  poster_url: string | null;
  trailer_embed_url: string | null;
  processed_status: "PENDING" | "SUCCESS" | "FAILED";
  last_updated: string;

  // --- NEW LOCAL MEDIA FIELDS ---
  is_downloaded: boolean; // True if the media file exists locally
  local_filepath: string | null; // Full path to the file
  file_size_bytes: number | null; // Size in bytes
  resolution: string | null; // E.g., 1080p, 4K
}

// ----------------------------------------------------------------------
// 6. Utility Types
// ----------------------------------------------------------------------

/**
 * Defines the structure of the result when fetching a batch of IDs for processing.
 * Used by the getNextBatch function in synchronizer.ts.
 */
export interface PendingTitleId {
  tconst: string;
}
