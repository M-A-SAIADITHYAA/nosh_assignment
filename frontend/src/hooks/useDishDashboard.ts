import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Dish,
  DishDraft,
  ConflictState,
  RemoteUpdateState,
  ConnectionStatus,
  ToastMessage,
} from '../types.js';
import {
  getDishes,
  patchDish,
  ConflictError,
  ValidationError,
  NetworkError,
} from '../api.js';

export function useDishDashboard() {
  const [dishes, setDishes] = useState<Record<string, Dish>>({});
  const [drafts, setDrafts] = useState<Record<string, DishDraft>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [conflicts, setConflicts] = useState<Record<string, ConflictState>>({});
  const [remoteUpdates, setRemoteUpdates] = useState<Record<string, RemoteUpdateState>>({});

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Refs to avoid stale closures in SSE and polling callbacks
  const dishesRef = useRef(dishes);
  dishesRef.current = dishes;

  const draftsRef = useRef(drafts);
  draftsRef.current = drafts;

  // Add toast helper
  const addToast = useCallback(
    (type: ToastMessage['type'], title: string, description?: string) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, title, description }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4500);
    },
    []
  );

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Initial load
  const loadDishes = useCallback(async () => {
    setIsLoading(true);
    setGlobalError(null);
    try {
      const data = await getDishes();
      const map: Record<string, Dish> = {};
      for (const d of data) {
        map[d.dishId] = d;
      }
      setDishes(map);
    } catch (err) {
      setGlobalError(err instanceof Error ? err.message : 'Failed to fetch dishes');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDishes();
  }, [loadDishes]);

  // Draft editing handlers
  const updateDraft = useCallback(
    (dishId: string, updates: Partial<DishDraft>) => {
      const original = dishesRef.current[dishId];
      if (!original) return;

      const currentDraft = draftsRef.current[dishId] || {
        dishName: original.dishName,
        isPublished: original.isPublished,
      };

      const newDraft: DishDraft = {
        ...currentDraft,
        ...updates,
      };

      // Check if new draft is identical to original saved state
      const isIdentical =
        newDraft.dishName === original.dishName &&
        newDraft.isPublished === original.isPublished;

      if (isIdentical) {
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[dishId];
          return next;
        });
      } else {
        setDrafts((prev) => ({
          ...prev,
          [dishId]: newDraft,
        }));
      }

      // Clear previous validation error when user modifies draft
      setErrors((prev) => {
        if (!prev[dishId]) return prev;
        const next = { ...prev };
        delete next[dishId];
        return next;
      });
    },
    []
  );

  // Discard local draft and restore last loaded/saved values
  const discardDraft = useCallback((dishId: string) => {
    setDrafts((prev) => {
      const next = { ...prev };
      delete next[dishId];
      return next;
    });

    setErrors((prev) => {
      const next = { ...prev };
      delete next[dishId];
      return next;
    });

    setConflicts((prev) => {
      const next = { ...prev };
      delete next[dishId];
      return next;
    });

    // If an external update was pending for this card, apply it now
    setRemoteUpdates((prev) => {
      if (prev[dishId]) {
        const remote = prev[dishId].remoteDish;
        setDishes((dishMap) => ({ ...dishMap, [dishId]: remote }));
        const next = { ...prev };
        delete next[dishId];
        return next;
      }
      return prev;
    });

    addToast('info', 'Draft discarded', `Restored dish #${dishId} to last saved state.`);
  }, [addToast]);

  // Save draft
  const saveDish = useCallback(
    async (dishId: string) => {
      const dish = dishesRef.current[dishId];
      const draft = draftsRef.current[dishId];

      if (!dish || !draft) return;

      setSaving((prev) => ({ ...prev, [dishId]: true }));
      setErrors((prev) => {
        const next = { ...prev };
        delete next[dishId];
        return next;
      });

      try {
        // Send draft with expected version
        const savedDish = await patchDish(dishId, draft, dish.version);

        // Success: update saved state, clear draft and conflict
        setDishes((prev) => ({ ...prev, [dishId]: savedDish }));
        setDrafts((prev) => {
          const next = { ...prev };
          delete next[dishId];
          return next;
        });
        setConflicts((prev) => {
          const next = { ...prev };
          delete next[dishId];
          return next;
        });
        setRemoteUpdates((prev) => {
          const next = { ...prev };
          delete next[dishId];
          return next;
        });

        addToast(
          'success',
          'Changes saved!',
          `"${savedDish.dishName}" updated to version ${savedDish.version}.`
        );
      } catch (err) {
        if (err instanceof ConflictError) {
          // 409 Conflict: preserve draft, store conflict state
          setConflicts((prev) => ({
            ...prev,
            [dishId]: {
              currentDish: err.currentDish,
              currentVersion: err.currentVersion,
              expectedVersion: err.expectedVersion,
              message: err.message,
            },
          }));
          addToast(
            'error',
            'Update Conflict (409)',
            `Dish #${dishId} was modified elsewhere. Your draft has been kept safe.`
          );
        } else if (err instanceof ValidationError) {
          // 400 Validation error: preserve draft, show useful error
          setErrors((prev) => ({
            ...prev,
            [dishId]: err.message,
          }));
          addToast('error', 'Validation Error', err.message);
        } else if (err instanceof NetworkError) {
          // Network error: preserve draft, allow retry
          setErrors((prev) => ({
            ...prev,
            [dishId]: err.message,
          }));
          addToast('error', 'Network Failure', err.message);
        } else {
          // Unexpected error
          const msg = err instanceof Error ? err.message : 'Failed to save dish';
          setErrors((prev) => ({
            ...prev,
            [dishId]: msg,
          }));
          addToast('error', 'Save Failed', msg);
        }
      } finally {
        setSaving((prev) => ({ ...prev, [dishId]: false }));
      }
    },
    [addToast]
  );

  // Reload action for 409 conflict or remote update with warning that it discards local draft
  const reloadDishFromConflict = useCallback(
    (dishId: string) => {
      const conflict = conflicts[dishId];
      if (conflict) {
        setDishes((prev) => ({ ...prev, [dishId]: conflict.currentDish }));
        discardDraft(dishId);
        addToast(
          'info',
          'Reloaded from server',
          `Discarded draft and synced to version ${conflict.currentVersion}.`
        );
      }
    },
    [conflicts, discardDraft, addToast]
  );

  const applyRemoteUpdate = useCallback(
    (dishId: string) => {
      const remote = remoteUpdates[dishId];
      if (remote) {
        setDishes((prev) => ({ ...prev, [dishId]: remote.remoteDish }));
        discardDraft(dishId);
        addToast(
          'info',
          'Remote update applied',
          `Synced dish #${dishId} to latest remote version ${remote.remoteVersion}.`
        );
      }
    },
    [remoteUpdates, discardDraft, addToast]
  );

  const dismissRemoteUpdate = useCallback((dishId: string) => {
    setRemoteUpdates((prev) => {
      const next = { ...prev };
      delete next[dishId];
      return next;
    });
  }, []);

  // Real-time synchronization via SSE (with automatic polling fallback)
  useEffect(() => {
    let eventSource: EventSource | null = null;
    let fallbackPollTimer: ReturnType<typeof setInterval> | null = null;
    let isCleanedUp = false;

    function connectSSE() {
      if (isCleanedUp) return;

      const API_BASE = import.meta.env.VITE_API_BASE_URL || '';
      const sseUrl = `${API_BASE}/events`;

      try {
        eventSource = new EventSource(sseUrl);

        eventSource.onopen = () => {
          if (!isCleanedUp) {
            setConnectionStatus('connected');
          }
        };

        eventSource.onmessage = (event) => {
          if (isCleanedUp) return;
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'DISH_UPDATED' && data.dish) {
              const updatedDish: Dish = data.dish;
              const id = updatedDish.dishId;

              // Core check: Does the user currently have an uncommitted local draft?
              const hasDraft = Boolean(draftsRef.current[id]);

              if (!hasDraft) {
                // No active draft: reflect change immediately and smoothly
                setDishes((prev) => ({ ...prev, [id]: updatedDish }));
              } else {
                // Unsaved draft exists: DO NOT REPLACE DRAFT!
                // Signal to user that newer saved data is available on server
                setRemoteUpdates((prev) => ({
                  ...prev,
                  [id]: {
                    remoteDish: updatedDish,
                    remoteVersion: updatedDish.version,
                    receivedAt: new Date().toLocaleTimeString(),
                  },
                }));
              }
            }
          } catch {
            // Heartbeat or unparseable event, ignore
          }
        };

        eventSource.onerror = () => {
          if (!isCleanedUp) {
            setConnectionStatus('reconnecting');
            eventSource?.close();
            // Start fallback polling if not already started
            startFallbackPolling();
            // Retry SSE connection in 5 seconds
            setTimeout(connectSSE, 5000);
          }
        };
      } catch {
        setConnectionStatus('disconnected');
        startFallbackPolling();
      }
    }

    function startFallbackPolling() {
      if (fallbackPollTimer || isCleanedUp) return;
      // Poll every 4 seconds as per requirement (<= 5s)
      fallbackPollTimer = setInterval(async () => {
        try {
          const fresh = await getDishes();
          if (isCleanedUp) return;
          setDishes((prev) => {
            const next = { ...prev };
            for (const d of fresh) {
              const hasDraft = Boolean(draftsRef.current[d.dishId]);
              if (!hasDraft) {
                next[d.dishId] = d;
              } else if (prev[d.dishId] && d.version > prev[d.dishId].version) {
                setRemoteUpdates((r) => ({
                  ...r,
                  [d.dishId]: {
                    remoteDish: d,
                    remoteVersion: d.version,
                    receivedAt: new Date().toLocaleTimeString(),
                  },
                }));
              }
            }
            return next;
          });
        } catch {
          // Polling error silently handled
        }
      }, 4000);
    }

    connectSSE();

    return () => {
      isCleanedUp = true;
      if (eventSource) {
        eventSource.close();
      }
      if (fallbackPollTimer) {
        clearInterval(fallbackPollTimer);
      }
    };
  }, []);

  return {
    dishes,
    drafts,
    saving,
    errors,
    conflicts,
    remoteUpdates,
    isLoading,
    globalError,
    connectionStatus,
    toasts,
    updateDraft,
    discardDraft,
    saveDish,
    reloadDishFromConflict,
    applyRemoteUpdate,
    dismissRemoteUpdate,
    removeToast,
    refreshAll: loadDishes,
  };
}
