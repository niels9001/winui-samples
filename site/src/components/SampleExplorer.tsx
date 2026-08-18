import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { DismissRegular } from "@fluentui/react-icons/svg/dismiss";
import { FilterRegular } from "@fluentui/react-icons/svg/filter";
import { SearchRegular } from "@fluentui/react-icons/svg/search";

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

export interface ExplorerSamplePresentation {
  entry: IndexedSample;
  heroUrl?: string;
  heroAlt?: string;
}

interface SampleExplorerProps {
  samples: ExplorerSamplePresentation[];
  categories: CatalogCategory[];
  basePath: string;
}

const facetTitles: Record<ExplorerFacetKey, string> = {
  source: "Source",
  primaryCategory: "Category",
  secondaryCategory: "Related categories",
  tag: "Topics",
  capability: "Package capabilities",
  hardware: "Hardware",
  accountService: "Accounts and services",
  architecture: "Architecture",
  capture: "Preview recipe",
};

function createFacetRecord<T>(
  createValue: (key: ExplorerFacetKey) => T,
): Record<ExplorerFacetKey, T> {
  return {
    source: createValue("source"),
    primaryCategory: createValue("primaryCategory"),
    secondaryCategory: createValue("secondaryCategory"),
    tag: createValue("tag"),
    capability: createValue("capability"),
    hardware: createValue("hardware"),
    accountService: createValue("accountService"),
    architecture: createValue("architecture"),
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
              key === "source" ||
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
            {sample.project.name} · {sample.scenarioCount}{" "}
            {sample.scenarioCount === 1 ? "scenario" : "scenarios"}
          </p>
        </div>
        <p className="explorer-card-summary">{sample.summary}</p>
        <div className="explorer-card-requirements">
          <span>{sample.supportedArchitectures.join(" / ")}</span>
          <span>Windows {sample.minimumWindowsVersion}+</span>
        </div>
      </div>
    </article>
  );
}

export function SampleExplorer({
  samples,
  categories,
  basePath,
}: SampleExplorerProps) {
  const mobile = useMobileLayout();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, setState] = useState(createDefaultExplorerState);
  const initializedFromUrl = useRef(false);
  const presentations = useMemo(
    () => new Map(samples.map((item) => [item.entry.sample.id, item])),
    [samples],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const index = useMemo(
    () => samples.map((item) => item.entry),
    [samples],
  );
  const options = useMemo(
    () => getFacetOptions(index),
    [index],
  );

  useEffect(() => {
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
  }, [options]);

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

  return (
    <div className="sample-explorer">
      <div className="explorer-toolbar">
        <label className="explorer-search">
          <span className="visually-hidden">Search examples</span>
          <SearchRegular aria-hidden="true" />
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
          <FilterRegular aria-hidden="true" />
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
                <DismissRegular aria-hidden="true" />
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
                  <DismissRegular aria-hidden="true" />
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
                  ? `${selectedCount} filters applied`
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

          {samples.length === 0 ? (
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
              <DismissRegular aria-hidden="true" />
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
