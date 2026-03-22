import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import type { LogEntry } from "@flink-reactor/ui"
import { useFilterStore } from "@/stores/filter-store"
import { useLogStore } from "@/stores/log-store"

// ---------------------------------------------------------------------------
// useFilteredLogs — applies active filters to log buffer with memoization
// ---------------------------------------------------------------------------

export function useFilteredLogs(): LogEntry[] {
  const entries = useLogStore((s) => s.entries)
  const enabledLevels = useFilterStore((s) => s.enabledLevels)
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const isRegex = useFilterStore((s) => s.isRegex)
  const selectedSources = useFilterStore((s) => s.selectedSources)
  const timeRange = useFilterStore((s) => s.timeRange)

  return useMemo(() => {
    // Build search predicate
    let searchPredicate: ((entry: LogEntry) => boolean) | null = null
    if (searchQuery) {
      if (isRegex) {
        try {
          const regex = new RegExp(searchQuery, "i")
          searchPredicate = (e) =>
            regex.test(e.message) || regex.test(e.logger) || regex.test(e.raw)
        } catch {
          // Invalid regex — treat as literal
          const lower = searchQuery.toLowerCase()
          searchPredicate = (e) =>
            e.message.toLowerCase().includes(lower) ||
            e.logger.toLowerCase().includes(lower)
        }
      } else {
        const lower = searchQuery.toLowerCase()
        searchPredicate = (e) =>
          e.message.toLowerCase().includes(lower) ||
          e.logger.toLowerCase().includes(lower)
      }
    }

    const hasSourceFilter = selectedSources.size > 0

    return entries.filter((entry) => {
      // Level filter
      if (!enabledLevels[entry.level]) return false

      // Source filter (empty = all sources pass)
      if (hasSourceFilter && !selectedSources.has(entry.source.id)) return false

      // Time range filter
      if (timeRange.start && entry.timestamp < timeRange.start) return false
      if (timeRange.end && entry.timestamp > timeRange.end) return false

      // Search filter
      if (searchPredicate && !searchPredicate(entry)) return false

      return true
    })
  }, [entries, enabledLevels, searchQuery, isRegex, selectedSources, timeRange])
}

// ---------------------------------------------------------------------------
// useSearchMatches — pre-computes match IDs with debounce, O(1) navigation
// ---------------------------------------------------------------------------

export function useSearchMatches() {
  const entries = useLogStore((s) => s.entries)
  const searchQuery = useFilterStore((s) => s.searchQuery)
  const isRegex = useFilterStore((s) => s.isRegex)

  const [matchIds, setMatchIds] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced match computation (300ms)
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    if (!searchQuery) {
      setMatchIds([])
      setCurrentIndex(0)
      return
    }

    debounceRef.current = setTimeout(() => {
      let predicate: (entry: LogEntry) => boolean

      if (isRegex) {
        try {
          const regex = new RegExp(searchQuery, "i")
          predicate = (e) =>
            regex.test(e.message) || regex.test(e.logger) || regex.test(e.raw)
        } catch {
          const lower = searchQuery.toLowerCase()
          predicate = (e) =>
            e.message.toLowerCase().includes(lower) ||
            e.logger.toLowerCase().includes(lower)
        }
      } else {
        const lower = searchQuery.toLowerCase()
        predicate = (e) =>
          e.message.toLowerCase().includes(lower) ||
          e.logger.toLowerCase().includes(lower)
      }

      const ids = entries.filter(predicate).map((e) => e.id)
      setMatchIds(ids)
      setCurrentIndex(ids.length > 0 ? 0 : -1)
    }, 300)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [entries, searchQuery, isRegex])

  const next = useCallback(() => {
    setCurrentIndex((i) =>
      matchIds.length === 0 ? -1 : (i + 1) % matchIds.length,
    )
  }, [matchIds])

  const prev = useCallback(() => {
    setCurrentIndex((i) =>
      matchIds.length === 0 ? -1 : (i - 1 + matchIds.length) % matchIds.length,
    )
  }, [matchIds])

  const currentMatchId = matchIds[currentIndex] ?? null

  return {
    matchIds,
    currentIndex,
    currentMatchId,
    matchCount: matchIds.length,
    next,
    prev,
  }
}

// ---------------------------------------------------------------------------
// useAutoScroll — ref-based, pauses on scroll-up, resumes on action
// ---------------------------------------------------------------------------

export function useAutoScroll<T extends HTMLElement>() {
  const containerRef = useRef<T>(null)
  const [isAutoScrolling, setIsAutoScrolling] = useState(true)
  const userScrolledRef = useRef(false)
  const prevScrollTopRef = useRef(0)

  // Detect user scroll direction
  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const { scrollTop, scrollHeight, clientHeight } = el
    const atBottom = scrollHeight - scrollTop - clientHeight < 50

    // User scrolled up — pause auto-scroll
    if (scrollTop < prevScrollTopRef.current && !atBottom) {
      userScrolledRef.current = true
      setIsAutoScrolling(false)
    }

    // User scrolled back to bottom — resume
    if (atBottom && userScrolledRef.current) {
      userScrolledRef.current = false
      setIsAutoScrolling(true)
    }

    prevScrollTopRef.current = scrollTop
  }, [])

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    userScrolledRef.current = false
    setIsAutoScrolling(true)
  }, [])

  // Auto-scroll effect (call this when entries change)
  const scrollIfNeeded = useCallback(() => {
    if (!isAutoScrolling) return
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [isAutoScrolling])

  // Programmatically pause auto-scroll (e.g. when selecting a log entry)
  const pauseAutoScroll = useCallback(() => {
    userScrolledRef.current = true
    setIsAutoScrolling(false)
  }, [])

  return {
    containerRef,
    isAutoScrolling,
    handleScroll,
    scrollToBottom,
    scrollIfNeeded,
    pauseAutoScroll,
  }
}
