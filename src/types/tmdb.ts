export type TMDBSearchResponse = {
  movie_results: TMDBMovieResult[];
  person_results: TMDBPersonResult[];
  tv_results: TMDBTVResult[];
  tv_episode_results: TMDBTVEpisodeResult[];
  tv_season_results: TMDBTVSeasonResult[];
};

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

// You can scaffold these as needed:
export type TMDBPersonResult = Record<string, unknown>;
export type TMDBTVResult = Record<string, unknown>;
export type TMDBTVEpisodeResult = Record<string, unknown>;
export type TMDBTVSeasonResult = Record<string, unknown>;
