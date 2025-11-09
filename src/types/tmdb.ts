/**
 * Represents the shape of the multi-search response from The Movie Database (TMDB) API.
 */
export type TMDBSearchResponse = {
    movie_results: TMDBMovieResult[];
    person_results: TMDBPersonResult[];
    tv_results: TMDBTVResult[];
    tv_episode_results: TMDBTVEpisodeResult[];
    tv_season_results: TMDBTVSeasonResult[];
};

/**
 * Represents a single movie result from the TMDB API.
 */
export type TMDBMovieResult = {
    adult: boolean;
    backdrop_path: string | null;
    id: number;
    title: string;
    original_language: string;
    original_title: string;
    overview: string;
    poster_path: string | null;
    media_type: string;
    genre_ids: number[];
    popularity: number;
    release_date: string;
    video: boolean;
    vote_average: number;
    vote_count: number;
};

/** Placeholder type for a person result from the TMDB API. */
export type TMDBPersonResult = Record<string, unknown>;
/** Placeholder type for a TV show result from the TMDB API. */
export type TMDBTVResult = Record<string, unknown>;
/** Placeholder type for a TV episode result from the TMDB API. */
export type TMDBTVEpisodeResult = Record<string, unknown>;
/** Placeholder type for a TV season result from the TMDB API. */
export type TMDBTVSeasonResult = Record<string, unknown>;
