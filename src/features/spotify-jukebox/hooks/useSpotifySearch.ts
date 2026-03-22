'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { SpotifySearchResults } from '../types';

const DEBOUNCE_MS = 300;

interface SearchState {
  results: SpotifySearchResults | null;
  isSearching: boolean;
  error: string | null;
}

export function useSpotifySearch() {
  const [state, setState] = useState<SearchState>({
    results: null,
    isSearching: false,
    error: null,
  });

  const [query, setQuery] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const requestIdRef = useRef(0);

  // Perform search
  const search = useCallback(async (searchQuery: string, type?: string) => {
    if (!searchQuery.trim()) {
      setState({ results: null, isSearching: false, error: null });
      return;
    }

    const requestId = ++requestIdRef.current;
    setState((prev) => ({ ...prev, isSearching: true, error: null }));

    try {
      const params = new URLSearchParams({ q: searchQuery });
      if (type) {
        params.set('type', type);
      }

      const response = await fetch(`/api/spotify/search?${params}`);
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const detail =
          body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string'
            ? body.detail
            : body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
              ? body.error
              : 'Search failed';
        throw new Error(detail);
      }

      const results: SpotifySearchResults = body as SpotifySearchResults;
      if (requestId !== requestIdRef.current) {
        return;
      }
      setState({ results, isSearching: false, error: null });
    } catch (err) {
      if (requestId !== requestIdRef.current) {
        return;
      }
      console.error('Search failed:', err);
      setState((prev) => ({
        ...prev,
        isSearching: false,
        error: err instanceof Error ? err.message : 'Search failed. Please try again.',
      }));
    }
  }, []);

  // Debounced search
  const debouncedSearch = useCallback(
    (searchQuery: string) => {
      setQuery(searchQuery);

      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      requestIdRef.current += 1;

      if (!searchQuery.trim()) {
        setState({ results: null, isSearching: false, error: null });
        return;
      }

      debounceRef.current = setTimeout(() => {
        search(searchQuery);
      }, DEBOUNCE_MS);
    },
    [search]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  // Clear search
  const clearSearch = useCallback(() => {
    setQuery('');
    requestIdRef.current += 1;
    setState({ results: null, isSearching: false, error: null });
  }, []);

  return {
    query,
    setQuery: debouncedSearch,
    clearSearch,
    results: state.results,
    isSearching: state.isSearching,
    error: state.error,
    tracks: state.results?.tracks?.items || [],
    playlists: state.results?.playlists?.items || [],
  };
}
