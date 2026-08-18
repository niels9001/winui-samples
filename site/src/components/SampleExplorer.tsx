import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import type {
  BrowseIndexPayload,
} from "../lib/browse-index";
import type {
  CatalogCategory,
} from "../lib/catalog";
import {
  clearExplorerFilters,
  createDefaultExplorerState,
  explorerFacetKeys,
  filterAndSortSamples,
  getFacetCounts,
  getFacetOptions,
  parseExplorerState,
  selectedFilterCount,
  serializeExplorerState,
  visibleExplorerFacetKeys,
} from "../lib/explorer";
import type {
  ExplorerFacetKey,
  ExplorerFacetOption,
  ExplorerSort,
  ExplorerState,
  IndexedSample,
} from "../lib/explorer";
import { withBasePath } from "../lib/base-path";
import { sampleDetailPath } from "../lib/urls";
import { SampleVisual } from "./SampleVisual";
import "./SampleExplorer.css";

interface IconProps {
  className?: string;
}

function SearchIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      <circle cx="8.5" cy="8.5" r="5.25" stroke="currentColor" strokeWidth="1.5" />
      <path d="m12.5 12.5 4 4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function FilterIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      <path d="M3 5h14M5.5 10h9M8 15h4" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

function DismissIcon({ className }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 20 20"
    >
      <path d="m5 5 10 10M15 5 5 15" stroke="currentColor" strokeLinecap="round" strokeWidth="1.5" />
    </svg>
  );
}

export interface ExplorerSamplePresentation {
  entry: IndexedSample;
  heroUrl?: string;
  heroAlt?: string;
}

interface SampleExplorerProps {
  basePath: string;
  expectedCatalogHash: string;
  expectedIndexHash: string;
  expectedRecordCount: number;
  indexIntegrity: string;
  indexUrl: string;
}

const facetTitles: Record<ExplorerFacetKey, string> = {
  provider: "Source",
  primaryCategory: "Category",
  secondaryCategory: "Related categories",
  tag: "Topics",
  capability: "Package capabilities",
  hardware: "Hardware",
  accountService: "Accounts and services",
  architecture: "Architecture",
  language: "Language",
  capture: "Preview recipe",
};

function createFacetRecord<T>(
  createValue: (key: ExplorerFacetKey) => T,
): Record<ExplorerFacetKey, T> {
  return {
    provider: createValue("provider"),
    primaryCategory: createValue("primaryCategory"),
    secondaryCategory: createValue("secondaryCategory"),
    tag: createValue("tag"),
    capability: createValue("capability"),
    hardware: createValue("hardware"),
    accountService: createValue("accountService"),
    architecture: createValue("architecture"),
    language: createValue("language"),
    capture: createValue("capture"),
  };
}

function useMobileLayout(): boolean {
  const [mobile, setMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 64rem)");
    const update = () => setMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  return mobile;
}

function sanitizeState(
  state: ExplorerState,
  options: Record<ExplorerFacetKey, ExplorerFacetOption[]>,
): ExplorerState {
  const next = {
    ...state,
    facets: { ...state.facets },
  };

  for (const key of explorerFacetKeys) {
    const allowed = new Set(options[key].map((option) => option.value));
    next.facets[key] = state.facets[key].filter((value) =>
      allowed.has(value),
    );
  }

  return next;
}

interface FilterPanelProps {
  state: ExplorerState;
  options: Record<ExplorerFacetKey, ExplorerFacetOption[]>;
  counts: Record<ExplorerFacetKey, ReadonlyMap<string, number>>;
  onToggle: (
    facet: ExplorerFacetKey,
    value: string,
    checked: boolean,
  ) => void;
  onClear: () => void;
}

function FilterPanel({
  state,
  options,
  counts,
  onToggle,
  onClear,
}: FilterPanelProps) {
  const count = selectedFilterCount(state);
  const [expandedFacets, setExpandedFacets] = useState<
    Set<ExplorerFacetKey>
  >(new Set());

  return (
    <div className="explorer-filter-content">
      <div className="explorer-filter-heading">
        <div>
          <p>Refine</p>
          <h2>Filters</h2>
        </div>
        {count > 0 && (
          <button className="text-button" onClick={onClear} type="button">
            Clear
          </button>
        )}
      </div>

      {visibleExplorerFacetKeys.map((key) => {
        if (options[key].length === 0) return null;

        const optionLimit =
          key === "primaryCategory" || key === "secondaryCategory" ? 10 : 7;
        const orderedOptions = [...options[key]].sort((left, right) => {
          const leftSelected = state.facets[key].includes(left.value);
          const rightSelected = state.facets[key].includes(right.value);
          if (leftSelected !== rightSelected) return leftSelected ? -1 : 1;

          const countDifference =
            (counts[key].get(right.value) ?? 0) -
            (counts[key].get(left.value) ?? 0);
          return (
            countDifference ||
            left.label.localeCompare(right.label, "en-US", {
              sensitivity: "base",
            })
          );
        });
        const expanded = expandedFacets.has(key);
        const initiallyVisible = orderedOptions.slice(0, optionLimit);
        const selectedOutsideLimit = orderedOptions.filter(
          (option, index) =>
            index >= optionLimit &&
            state.facets[key].includes(option.value),
        );
        const visibleOptions = expanded
          ? orderedOptions
          : [...initiallyVisible, ...selectedOutsideLimit];

        return (
          <details
            className="explorer-facet"
            open={
              key === "provider" ||
              key === "primaryCategory" ||
              state.facets[key].length > 0
                ? true
                : undefined
            }
            key={key}
          >
            <summary>
              <span>{facetTitles[key]}</span>
              <span>
                {state.facets[key].length > 0
                  ? state.facets[key].length
                  : options[key].length}
              </span>
            </summary>
            <fieldset>
              <legend className="visually-hidden">{facetTitles[key]}</legend>
              <div className="explorer-facet-options">
                {visibleOptions.map((option) => {
                  const checked = state.facets[key].includes(option.value);
                  const optionCount = counts[key].get(option.value) ?? 0;
                  return (
                    <label className="explorer-checkbox" key={option.value}>
                      <input
                        checked={checked}
                        disabled={!checked && optionCount === 0}
                        onChange={(event) =>
                          onToggle(key, option.value, event.target.checked)
                        }
                        type="checkbox"
                      />
                      <span>{option.label}</span>
                      <small aria-hidden="true">{optionCount}</small>
                    </label>
                  );
                })}
              </div>
              {orderedOptions.length > optionLimit && (
                <button
                  className="text-button facet-more"
                  onClick={() =>
                    setExpandedFacets((current) => {
                      const next = new Set(current);
                      if (next.has(key)) next.delete(key);
                      else next.add(key);
                      return next;
                    })
                  }
                  type="button"
                >
                  {expanded ? "Show less" : `Show all ${orderedOptions.length}`}
                </button>
              )}
            </fieldset>
          </details>
        );
      })}
    </div>
  );
}

interface SampleCardProps {
  presentation: ExplorerSamplePresentation;
  category?: CatalogCategory;
  basePath: string;
}

function SampleCard({
  presentation,
  category,
  basePath,
}: SampleCardProps) {
  const { entry, heroAlt, heroUrl } = presentation;
  const sample = entry.sample;
  const href = withBasePath(sampleDetailPath(sample.id), basePath);
  const categoryId = category?.id ?? sample.categories.primary;
  const categoryLabel = category?.label ?? sample.categories.primary;

  return (
    <article className="explorer-card">
      <a className="explorer-card-visual-link" href={href} tabIndex={-1}>
        <SampleVisual
          categoryId={categoryId}
          categoryLabel={categoryLabel}
          visualLabel={sample.project.name}
          heroAlt={heroAlt}
          heroUrl={heroUrl}
        />
      </a>
      <div className="explorer-card-body">
        <div className="explorer-card-meta">
          <span>{categoryLabel}</span>
          <span>{sample.source.label}</span>
        </div>
        <div className="explorer-card-heading">
          <h3>
            <a href={href}>{sample.title}</a>
          </h3>
          <p className="technical-name">
            {sample.project.name} · {sample.contentCount} {sample.contentLabel}
          </p>
        </div>
        {sample.summary && (
          <p className="explorer-card-summary">{sample.summary}</p>
        )}
        <div className="explorer-card-requirements">
          {sample.languages.length > 0 && (
            <span>{sample.languages.join(" / ")}</span>
          )}
          {sample.supportedArchitectures.length > 0 && (
            <span>{sample.supportedArchitectures.join(" / ")}</span>
          )}
          {sample.minimumWindowsVersion && (
            <span>Windows {sample.minimumWindowsVersion}</span>
          )}
        </div>
      </div>
    </article>
  );
}

function digestToIntegrity(digest: ArrayBuffer): string {
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return `sha256-${btoa(binary)}`;
}

function assertBrowseIndex(
  value: unknown,
  expectedCatalogHash: string,
  expectedIndexHash: string,
  expectedRecordCount: number,
): asserts value is BrowseIndexPayload {
  if (
    !value ||
    typeof value !== "object" ||
    !("schemaVersion" in value) ||
    value.schemaVersion !== 1 ||
    !("catalogHash" in value) ||
    value.catalogHash !== expectedCatalogHash ||
    !("searchHash" in value) ||
    value.searchHash !== expectedIndexHash ||
    !("recordCount" in value) ||
    value.recordCount !== expectedRecordCount ||
    !("records" in value) ||
    !Array.isArray(value.records) ||
    value.records.length !== expectedRecordCount ||
    !("categories" in value) ||
    !Array.isArray(value.categories) ||
    !("media" in value) ||
    !value.media ||
    typeof value.media !== "object"
  ) {
    throw new Error("Browse index metadata does not match the catalog.");
  }
}

export function SampleExplorer({
  basePath,
  expectedCatalogHash,
  expectedIndexHash,
  expectedRecordCount,
  indexIntegrity,
  indexUrl,
}: SampleExplorerProps) {
  const [payload, setPayload] = useState<BrowseIndexPayload>();
  const [loadError, setLoadError] = useState(false);
  const mobile = useMobileLayout();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, setState] = useState(createDefaultExplorerState);
  const initializedFromUrl = useRef(false);
  useEffect(() => {
    const controller = new AbortController();

    async function loadIndex() {
      const response = await fetch(indexUrl, {
        cache: "force-cache",
        credentials: "same-origin",
        signal: controller.signal,
      });
      if (!response.ok) {
        throw new Error(`Browse index request failed with ${response.status}.`);
      }
      const bytes = await response.arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      if (digestToIntegrity(digest) !== indexIntegrity) {
        throw new Error("Browse index integrity verification failed.");
      }
      const value: unknown = JSON.parse(new TextDecoder().decode(bytes));
      assertBrowseIndex(
        value,
        expectedCatalogHash,
        expectedIndexHash,
        expectedRecordCount,
      );
      setPayload(value);
    }

    loadIndex().catch((error: unknown) => {
      if (controller.signal.aborted) {
        return;
      }
      console.error(error);
      setLoadError(true);
    });
    return () => controller.abort();
  }, [
    expectedCatalogHash,
    expectedIndexHash,
    expectedRecordCount,
    indexIntegrity,
    indexUrl,
  ]);

  const categories = payload?.categories ?? [];
  const index = (payload?.records ?? []) as IndexedSample[];
  const presentations = useMemo(
    () =>
      new Map(
        index.map((entry) => {
          const media = payload?.media[entry.sample.id];
          return [
            entry.sample.id,
            {
              entry,
              heroUrl: media?.url,
              heroAlt: media?.alt,
            },
          ];
        }),
      ),
    [index, payload?.media],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const options = useMemo(
    () => getFacetOptions(index),
    [index],
  );

  useEffect(() => {
    if (!payload) {
      return;
    }
    const applyUrlState = () => {
      setState(
        sanitizeState(
          parseExplorerState(window.location.search),
          options,
        ),
      );
    };

    applyUrlState();
    initializedFromUrl.current = true;
    window.addEventListener("popstate", applyUrlState);
    return () => window.removeEventListener("popstate", applyUrlState);
  }, [options, payload]);

  useEffect(() => {
    if (!mobile) setDrawerOpen(false);
  }, [mobile]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (drawerOpen && !dialog.open) dialog.showModal();
    if (!drawerOpen && dialog.open) dialog.close();
  }, [drawerOpen]);

  const updateState = (
    nextState: ExplorerState,
    historyMode: "push" | "replace",
  ) => {
    setState(nextState);
    if (!initializedFromUrl.current) return;

    const url = new URL(window.location.href);
    const parameters = serializeExplorerState(nextState).toString();
    url.search = parameters.length > 0 ? `?${parameters}` : "";
    window.history[
      historyMode === "push" ? "pushState" : "replaceState"
    ]({}, "", url);
  };

  const toggleFacet = (
    facet: ExplorerFacetKey,
    value: string,
    checked: boolean,
  ) => {
    const selected = checked
      ? [...state.facets[facet], value]
      : state.facets[facet].filter((entry) => entry !== value);
    updateState(
      {
        ...state,
        facets: {
          ...state.facets,
          [facet]: selected,
        },
      },
      "push",
    );
  };

  const clearAll = () => {
    updateState(clearExplorerFilters(state), "push");
    setDrawerOpen(false);
  };

  const results = useMemo(
    () => filterAndSortSamples(index, state),
    [index, state],
  );
  const counts = createFacetRecord((key) =>
    getFacetCounts(index, state, key, options[key]),
  );
  const selectedCount = selectedFilterCount(state);
  const optionLookup = createFacetRecord<ReadonlyMap<string, string>>(
    (key) =>
      new Map(
        options[key].map((option) => [option.value, option.label]),
      ),
  );

  if (loadError) {
    return (
      <div className="explorer-empty surface" role="alert">
        <h2>The sample index could not be loaded</h2>
        <p>Reload the page to try the validated local index again.</p>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="explorer-empty surface" role="status">
        <h2>Loading examples</h2>
        <p>Preparing the offline sample index.</p>
      </div>
    );
  }

  return (
    <div className="sample-explorer">
      <div className="explorer-toolbar">
        <label className="explorer-search">
          <span className="visually-hidden">Search examples</span>
          <SearchIcon />
          <input
            onChange={(event) =>
              updateState(
                { ...state, query: event.target.value },
                "replace",
              )
            }
            placeholder="Search outcomes, APIs, and projects"
            type="search"
            value={state.query}
          />
        </label>
        <button
          aria-expanded={drawerOpen}
          className="explorer-filter-trigger"
          onClick={() => setDrawerOpen(true)}
          type="button"
        >
          <FilterIcon />
          Filters
          {selectedCount > 0 && <span>{selectedCount}</span>}
        </button>
        <label className="explorer-sort">
          <span>Sort</span>
          <select
            aria-label="Sort examples"
            onChange={(event) =>
              updateState(
                {
                  ...state,
                  sort: event.target.value as ExplorerSort,
                },
                "push",
              )
            }
            value={state.sort}
          >
            <option value="recommended">Recommended</option>
            <option value="title">Outcome A–Z</option>
            <option value="project">Project A–Z</option>
          </select>
        </label>
      </div>

      {(selectedCount > 0 || state.query.length > 0) && (
        <div className="explorer-active-filters" aria-label="Selected filters">
          <strong>
            {selectedCount + (state.query.length > 0 ? 1 : 0)} selected
          </strong>
          <div>
            {state.query.length > 0 && (
              <button
                className="explorer-filter-chip"
                onClick={() =>
                  updateState({ ...state, query: "" }, "push")
                }
                type="button"
              >
                “{state.query}”
                <DismissIcon />
                <span className="visually-hidden">Clear search</span>
              </button>
            )}
            {explorerFacetKeys.flatMap((key) =>
              state.facets[key].map((value) => (
                <button
                  className="explorer-filter-chip"
                  key={`${key}-${value}`}
                  onClick={() => toggleFacet(key, value, false)}
                  type="button"
                >
                  {optionLookup[key].get(value) ?? value}
                  <DismissIcon />
                  <span className="visually-hidden">Remove filter</span>
                </button>
              )),
            )}
            <button className="text-button" onClick={clearAll} type="button">
              Clear all
            </button>
          </div>
        </div>
      )}

      <div className="explorer-layout">
        {!mobile && (
          <aside className="explorer-sidebar" aria-label="Filter examples">
            <FilterPanel
              counts={counts}
              onClear={clearAll}
              onToggle={toggleFacet}
              options={options}
              state={state}
            />
          </aside>
        )}

        <div className="explorer-results">
          <div className="explorer-result-heading">
            <p>
              <strong>{results.length}</strong>{" "}
              {results.length === 1 ? "result" : "results"}
            </p>
            <p>
              {state.query.length > 0
                ? `For “${state.query}”`
                : selectedCount > 0
                  ? `${selectedCount} ${selectedCount === 1 ? "filter" : "filters"} applied`
                  : "All examples"}
            </p>
          </div>
          <p
            aria-atomic="true"
            aria-live="polite"
            className="visually-hidden"
          >
            {results.length} {results.length === 1 ? "result" : "results"} shown
          </p>

          {index.length === 0 ? (
            <div className="explorer-empty surface">
              <h2>No examples are available right now</h2>
              <p>Check back as more Windows projects are added.</p>
            </div>
          ) : results.length === 0 ? (
            <div className="explorer-empty surface">
              <h2>Nothing matches these choices</h2>
              <p>
                Remove a requirement or try an API, project, or outcome name.
              </p>
              <button className="primary-button" onClick={clearAll} type="button">
                Show all examples
              </button>
            </div>
          ) : (
            <div className="explorer-grid" role="list">
              {results.map((entry) => {
                const presentation = presentations.get(entry.sample.id);
                if (!presentation) return null;
                return (
                  <div key={entry.sample.id} role="listitem">
                    <SampleCard
                      basePath={basePath}
                      category={categoryMap.get(
                        entry.sample.categories.primary,
                      )}
                      presentation={presentation}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <dialog
        aria-labelledby="filter-dialog-title"
        className="explorer-drawer"
        onClick={(event) => {
          if (event.target === event.currentTarget) setDrawerOpen(false);
        }}
        onClose={() => setDrawerOpen(false)}
        ref={dialogRef}
      >
        <div className="explorer-drawer-panel">
          <header>
            <h2 id="filter-dialog-title">Filter examples</h2>
            <button
              aria-label="Close filters"
              className="icon-button"
              onClick={() => setDrawerOpen(false)}
              type="button"
            >
              <DismissIcon />
            </button>
          </header>
          <FilterPanel
            counts={counts}
            onClear={clearAll}
            onToggle={toggleFacet}
            options={options}
            state={state}
          />
        </div>
      </dialog>
    </div>
  );
}
