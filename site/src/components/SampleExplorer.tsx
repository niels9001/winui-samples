import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  Button,
} from "@fluentui/react-button";
import {
  Checkbox,
} from "@fluentui/react-checkbox";
import {
  DrawerBody,
  DrawerHeader,
  DrawerHeaderTitle,
  OverlayDrawer,
} from "@fluentui/react-drawer";
import {
  Input,
} from "@fluentui/react-input";
import {
  FluentProvider,
} from "@fluentui/react-provider";
import {
  Select,
} from "@fluentui/react-select";
import { webDarkTheme, webLightTheme } from "@fluentui/react-theme";
import { DismissRegular } from "@fluentui/react-icons/svg/dismiss";
import { FilterRegular } from "@fluentui/react-icons/svg/filter";
import { SearchRegular } from "@fluentui/react-icons/svg/search";

import type {
  CatalogCategory,
  CatalogSample,
} from "../lib/catalog";
import {
  clearExplorerFilters,
  createDefaultExplorerState,
  createExplorerIndex,
  explorerFacetKeys,
  filterAndSortSamples,
  getFacetCounts,
  getFacetOptions,
  parseExplorerState,
  selectedFilterCount,
  serializeExplorerState,
} from "../lib/explorer";
import type {
  ExplorerFacetKey,
  ExplorerFacetOption,
  ExplorerSort,
  ExplorerState,
} from "../lib/explorer";
import { withBasePath } from "../lib/base-path";
import { sampleDetailPath } from "../lib/urls";
import { SampleVisual } from "./SampleVisual";
import "./SampleExplorer.css";

export interface ExplorerSamplePresentation {
  sample: CatalogSample;
  heroUrl?: string;
  heroAlt?: string;
}

interface SampleExplorerProps {
  samples: ExplorerSamplePresentation[];
  categories: CatalogCategory[];
  basePath: string;
}

const facetTitles: Record<ExplorerFacetKey, string> = {
  primaryCategory: "Primary category",
  secondaryCategory: "Secondary categories",
  tag: "Topics",
  capability: "Declared package capabilities",
  hardware: "Actual hardware requirements",
  accountService: "Account or service prerequisites",
  architecture: "Architectures",
  capture: "Screenshot capture readiness",
};

function createFacetRecord<T>(
  createValue: (key: ExplorerFacetKey) => T,
): Record<ExplorerFacetKey, T> {
  return {
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

function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">("light");

  useEffect(() => {
    const updateTheme = () => {
      setTheme(
        document.documentElement.dataset.theme === "dark" ? "dark" : "light",
      );
    };
    updateTheme();

    const observer = new MutationObserver(updateTheme);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
    return () => observer.disconnect();
  }, []);

  return theme;
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

  return (
    <div className="explorer-filter-content">
      <div className="explorer-filter-heading">
        <div>
          <p className="explorer-filter-eyebrow">Refine results</p>
          <h2>Filters</h2>
        </div>
        {count > 0 && (
          <Button appearance="subtle" onClick={onClear} size="small">
            Clear all
          </Button>
        )}
      </div>

      {explorerFacetKeys.map((key) => {
        if (options[key].length === 0) {
          return null;
        }

        return (
          <fieldset className="explorer-facet" key={key}>
            <legend>{facetTitles[key]}</legend>
            <div className="explorer-facet-options">
              {options[key].map((option) => {
                const checked = state.facets[key].includes(option.value);
                const optionCount = counts[key].get(option.value) ?? 0;
                return (
                  <Checkbox
                    checked={checked}
                    disabled={!checked && optionCount === 0}
                    key={option.value}
                    label={
                      <span className="explorer-checkbox-label">
                        <span>{option.label}</span>
                        <span aria-hidden="true">{optionCount}</span>
                      </span>
                    }
                    onChange={(_, data) =>
                      onToggle(key, option.value, data.checked === true)
                    }
                  />
                );
              })}
            </div>
          </fieldset>
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
  const { sample, heroAlt, heroUrl } = presentation;
  const href = withBasePath(sampleDetailPath(sample.id), basePath);
  const categoryId = category?.id ?? sample.categories.primary;
  const categoryLabel = category?.label ?? sample.categories.primary;

  return (
    <article className="explorer-card">
      <a className="explorer-card-visual-link" href={href} tabIndex={-1}>
        <SampleVisual
          categoryId={categoryId}
          categoryLabel={categoryLabel}
          heroAlt={heroAlt}
          heroUrl={heroUrl}
        />
      </a>
      <div className="explorer-card-body">
        <div className="explorer-card-meta">
          <span className="explorer-category-badge">{categoryLabel}</span>
          <span>
            {sample.scenarios.length}{" "}
            {sample.scenarios.length === 1 ? "scenario" : "scenarios"}
          </span>
        </div>
        <div className="explorer-card-heading">
          <h3>
            <a href={href}>{sample.title}</a>
          </h3>
          <p className="technical-name">Project: {sample.project.name}</p>
        </div>
        <p className="explorer-card-summary">{sample.summary}</p>
        <div className="explorer-card-tags" aria-label="Topics">
          {sample.tags.slice(0, 3).map((tag) => (
            <span key={tag}>{tag}</span>
          ))}
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
  const theme = useResolvedTheme();
  const mobile = useMobileLayout();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [state, setState] = useState(createDefaultExplorerState);
  const initializedFromUrl = useRef(false);
  const presentations = useMemo(
    () => new Map(samples.map((entry) => [entry.sample.id, entry])),
    [samples],
  );
  const categoryMap = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const index = useMemo(
    () =>
      createExplorerIndex(
        samples.map((entry) => entry.sample),
        categories,
      ),
    [categories, samples],
  );
  const options = useMemo(
    () => getFacetOptions(index, categories),
    [categories, index],
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
    if (!mobile) {
      setDrawerOpen(false);
    }
  }, [mobile]);

  const updateState = (
    nextState: ExplorerState,
    historyMode: "push" | "replace",
  ) => {
    setState(nextState);
    if (!initializedFromUrl.current) {
      return;
    }

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
    <FluentProvider
      className="sample-explorer-provider"
      theme={theme === "dark" ? webDarkTheme : webLightTheme}
    >
      <div className="sample-explorer">
        <div className="explorer-toolbar">
          <Input
            aria-label="Search samples"
            className="explorer-search"
            contentBefore={<SearchRegular aria-hidden="true" />}
            onChange={(_, data) =>
              updateState(
                { ...state, query: data.value },
                "replace",
              )
            }
            placeholder="Search APIs, scenarios, projects, and topics"
            size="large"
            type="search"
            value={state.query}
          />
          <Button
            appearance="secondary"
            aria-expanded={drawerOpen}
            className="explorer-filter-trigger"
            icon={<FilterRegular />}
            onClick={() => setDrawerOpen(true)}
            size="large"
          >
            Filters{selectedCount > 0 ? ` (${selectedCount})` : ""}
          </Button>
          <label className="explorer-sort">
            <span>Sort by</span>
            <Select
              aria-label="Sort samples"
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
              <option value="title">Intent title</option>
              <option value="project">Technical project name</option>
            </Select>
          </label>
        </div>

        {(selectedCount > 0 || state.query.length > 0) && (
          <div className="explorer-active-filters" aria-label="Active filters">
            {state.query.length > 0 && (
              <button
                className="explorer-filter-chip"
                onClick={() =>
                  updateState({ ...state, query: "" }, "push")
                }
                type="button"
              >
                Search: {state.query}
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
            <Button appearance="subtle" onClick={clearAll} size="small">
              Clear all
            </Button>
          </div>
        )}

        <div className="explorer-layout">
          {!mobile && (
            <aside
              className="explorer-sidebar"
              aria-label="Filter samples"
            >
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
                {results.length === 1 ? "sample" : "samples"}
              </p>
              <p className="explorer-result-context">
                {state.query.length > 0
                  ? `Matching “${state.query}”`
                  : "Ready to explore"}
              </p>
            </div>
            <p
              aria-atomic="true"
              aria-live="polite"
              className="visually-hidden"
            >
              {results.length}{" "}
              {results.length === 1 ? "sample" : "samples"} shown
            </p>

            {samples.length === 0 ? (
              <div className="explorer-empty surface">
                <h2>Sample metadata is on its way</h2>
                <p>
                  The catalog can publish incrementally. Check back as sample
                  metadata is reviewed and added.
                </p>
              </div>
            ) : results.length === 0 ? (
              <div className="explorer-empty surface">
                <h2>No samples match these choices</h2>
                <p>
                  Try a broader search or clear the selected filters to return
                  to the published catalog.
                </p>
                <Button appearance="primary" onClick={clearAll}>
                  Clear search and filters
                </Button>
              </div>
            ) : (
              <div className="explorer-grid" role="list">
                {results.map((entry) => {
                  const presentation = presentations.get(entry.sample.id);
                  if (!presentation) {
                    return null;
                  }
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

        {mobile && (
          <OverlayDrawer
            modalType="modal"
            onOpenChange={(_, data) => setDrawerOpen(data.open)}
            open={drawerOpen}
            position="start"
          >
            <DrawerHeader>
              <DrawerHeaderTitle
                action={
                  <Button
                    appearance="subtle"
                    aria-label="Close filters"
                    icon={<DismissRegular />}
                    onClick={() => setDrawerOpen(false)}
                  />
                }
              >
                Filter samples
              </DrawerHeaderTitle>
            </DrawerHeader>
            <DrawerBody>
              <FilterPanel
                counts={counts}
                onClear={clearAll}
                onToggle={toggleFacet}
                options={options}
                state={state}
              />
            </DrawerBody>
          </OverlayDrawer>
        )}
      </div>
    </FluentProvider>
  );
}
