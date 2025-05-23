/** @jsxImportSource preact */
import { useEffect, useState, useRef } from "preact/hooks"
import { MainnetTable, TestnetTable, StreamsNetworkAddressesTable } from "./Tables.tsx"
import feedList from "./FeedList.module.css"
import tableStyles from "./Tables.module.css"
import { clsx } from "~/lib/clsx/clsx.ts"
import { Chain, CHAINS, ALL_CHAINS, ChainNetwork } from "~/features/data/chains.ts"
import { useGetChainMetadata } from "./useGetChainMetadata.ts"
import { ChainMetadata } from "~/features/data/api/index.ts"
import useQueryString from "~/hooks/useQueryString.ts"
import { RefObject } from "preact"
import SectionWrapper from "~/components/SectionWrapper/SectionWrapper.tsx"

export type DataFeedType = "default" | "smartdata" | "rates" | "streamsCrypto" | "streamsRwa"
export const FeedList = ({
  initialNetwork,
  dataFeedType = "default",
  ecosystem = "",
  initialCache,
}: {
  initialNetwork: string
  dataFeedType: DataFeedType
  ecosystem?: string
  initialCache?: Record<string, ChainMetadata>
}) => {
  const chains = ecosystem === "deprecating" ? ALL_CHAINS : CHAINS
  const isStreams = dataFeedType === "streamsCrypto" || dataFeedType === "streamsRwa"

  // Get network directly from URL
  const networkFromURL =
    typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("network") : null

  // If URL has a network param, use it directly
  const effectiveInitialNetwork = networkFromURL || initialNetwork

  // Initialize state with the URL value
  const [currentNetwork, setCurrentNetwork] = useState(effectiveInitialNetwork)

  // Get network directly from URL or fall back to initialNetwork
  const getNetworkFromURL = () => {
    if (typeof window === "undefined") return initialNetwork
    const params = new URLSearchParams(window.location.search)
    const networkParam = params.get("network")
    return networkParam || initialNetwork
  }

  // Force initial sync with URL
  useEffect(() => {
    // Get the latest network from URL
    const latestNetworkFromURL = getNetworkFromURL()
    if (latestNetworkFromURL !== currentNetwork) {
      setCurrentNetwork(latestNetworkFromURL)
    }

    // Force a redraw after a short delay
    if (typeof window !== "undefined") {
      // execute after the DOM is fully loaded
      window.addEventListener("load", () => {
        const networkFromURL = getNetworkFromURL()
        setCurrentNetwork(networkFromURL)

        // Force a repaint of aria-selected attributes
        document.querySelectorAll(".network-button").forEach((button) => {
          const buttonId = button.getAttribute("id")
          if (buttonId === networkFromURL) {
            button.setAttribute("aria-selected", "true")
          } else {
            button.setAttribute("aria-selected", "false")
          }
        })
      })
    }
  }, [])

  // Sync with URL when it changes externally (browser back/forward)
  useEffect(() => {
    if (!isStreams && typeof window !== "undefined") {
      const handleUrlChange = () => {
        const networkFromURL = getNetworkFromURL()
        if (networkFromURL !== currentNetwork) {
          setCurrentNetwork(networkFromURL)
        }
      }

      // Listen for popstate events (back/forward navigation)
      window.addEventListener("popstate", handleUrlChange)

      // Also check immediately in case URL was changed externally
      handleUrlChange()

      return () => {
        window.removeEventListener("popstate", handleUrlChange)
      }
    }
  }, [currentNetwork, isStreams])

  // Regular query string states
  const [searchValue, setSearchValue] = useQueryString("search", "")
  const [selectedFeedCategories, setSelectedFeedCategories] = useQueryString("categories", [])
  const [currentPage, setCurrentPage] = useQueryString("page", "1")

  // Update URL when network changes
  const updateNetworkInURL = (network: string) => {
    if (typeof window === "undefined") return

    const params = new URLSearchParams(window.location.search)
    params.set("network", network)
    const newUrl = window.location.pathname + "?" + params.toString()
    window.history.replaceState({ path: newUrl }, "", newUrl)
    setCurrentNetwork(network)
  }

  // Initialize all other states
  const [showCategoriesDropdown, setShowCategoriesDropdown] = useState<boolean>(false)
  const [showExtraDetails, setShowExtraDetails] = useState(false)
  const paginate = (pageNumber) => setCurrentPage(String(pageNumber))
  const addrPerPage = 8
  const lastAddr = Number(currentPage) * addrPerPage
  const firstAddr = lastAddr - addrPerPage
  const dataFeedCategory = [
    { key: "low", name: "Low Market Risk" },
    { key: "medium", name: "Medium Market Risk" },
    { key: "high", name: "High Market Risk" },
    { key: "custom", name: "Custom" },
    { key: "new", name: "New Token" },
    { key: "deprecating", name: "Deprecating" },
  ]
  const smartDataTypes = [
    { key: "Proof of Reserve", name: "Proof of Reserve" },
    { key: "NAVLink", name: "NAVLink" },
    { key: "SmartAUM", name: "SmartAUM" },
  ]
  const [streamsChain] = useState(initialNetwork)
  const activeChain = isStreams ? streamsChain : currentNetwork
  const chain = chains.find((c) => c.page === activeChain) || chains[0]
  const chainMetadata = useGetChainMetadata(chain, initialCache && initialCache[chain.page])
  const wrapperRef = useRef(null)
  const [showOnlySVR, setShowOnlySVR] = useState(false)

  // Network selection handler
  function handleNetworkSelect(chain: Chain) {
    if (!isStreams) {
      updateNetworkInURL(chain.page)
    }
    setSearchValue("")
    setSelectedFeedCategories([])
    setCurrentPage("1")
  }

  const handleCategorySelection = (category) => {
    paginate(1)
    if (typeof selectedFeedCategories === "string" && selectedFeedCategories !== category) {
      setSelectedFeedCategories([selectedFeedCategories, category])
    } else if (typeof selectedFeedCategories === "string" && selectedFeedCategories === category) {
      setSelectedFeedCategories([])
    }
    if (Array.isArray(selectedFeedCategories) && selectedFeedCategories.includes(category)) {
      setSelectedFeedCategories(selectedFeedCategories.filter((item) => item !== category))
    } else if (Array.isArray(selectedFeedCategories)) {
      setSelectedFeedCategories([...selectedFeedCategories, category])
    }
  }

  useEffect(() => {
    if (searchValue === "") {
      const searchParams = new URLSearchParams(window.location.search)
      searchParams.delete("search")
      const newUrl = window.location.pathname + "?" + searchParams.toString()
      window.history.replaceState({ path: newUrl }, "", newUrl)
      const inputElement = document.getElementById("search") as HTMLInputElement
      if (inputElement) {
        inputElement.placeholder = "Search"
      }
    }
  }, [chainMetadata.processedData, searchValue])

  const useOutsideAlerter = (ref: RefObject<HTMLDivElement>) => {
    useEffect(() => {
      function handleClickOutside(event: MouseEvent) {
        if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) {
          setShowCategoriesDropdown(false)
        }
      }
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }, [ref])
  }

  useOutsideAlerter(wrapperRef)
  const isSmartData = dataFeedType === "smartdata"
  const isRates = dataFeedType === "rates"
  const isDeprecating = ecosystem === "deprecating"
  let netCount = 0

  const streamsMainnetSectionTitle = dataFeedType === "streamsCrypto" ? "Mainnet Crypto Streams" : "Mainnet RWA Streams"
  const streamsTestnetSectionTitle = dataFeedType === "streamsCrypto" ? "Testnet Crypto Streams" : "Testnet RWA Streams"

  // handles button selection based on URL
  const NetworkSelectionUpdater = () => {
    // Update network buttons based on URL
    useEffect(() => {
      function updateNetworkButtons() {
        if (typeof window === "undefined") return

        // Get network from URL
        const urlParams = new URLSearchParams(window.location.search)
        const networkFromURL = urlParams.get("network")

        if (!networkFromURL) return

        // Update all network buttons using DOM API
        document.querySelectorAll(".network-button").forEach((button) => {
          const buttonId = button.getAttribute("id")
          if (buttonId === networkFromURL) {
            button.setAttribute("aria-selected", "true")
          } else {
            button.setAttribute("aria-selected", "false")
          }
        })
      }

      // Run immediately
      updateNetworkButtons()

      // Also run when DOM is fully loaded
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", updateNetworkButtons)
      }

      // And run after everything is loaded
      window.addEventListener("load", updateNetworkButtons)

      return () => {
        // Clean up listeners
        document.removeEventListener("DOMContentLoaded", updateNetworkButtons)
        window.removeEventListener("load", updateNetworkButtons)
      }
    }, [])

    return null
  }

  if (dataFeedType === "streamsCrypto" || dataFeedType === "streamsRwa") {
    const mainnetFeeds: ChainNetwork[] = []
    const testnetFeeds: ChainNetwork[] = []

    chainMetadata.processedData?.networks.forEach((network) => {
      if (network.name.includes("Arbitrum")) {
        if (network.networkType === "mainnet") {
          mainnetFeeds.push(network)
        } else if (network.networkType === "testnet") {
          testnetFeeds.push(network)
        }
      }
    })

    return (
      <>
        <SectionWrapper title="Streams Verifier Network Addresses" depth={2}>
          <StreamsNetworkAddressesTable />
        </SectionWrapper>

        <SectionWrapper title={streamsMainnetSectionTitle} depth={2}>
          <div className={feedList.tableFilters}>
            <form class={feedList.filterDropdown_search}>
              <input
                id="search"
                class={feedList.filterDropdown_searchInput}
                placeholder="Search"
                onInput={(event) => {
                  setSearchValue((event.target as HTMLInputElement).value)
                  setCurrentPage("1")
                }}
              />
            </form>
          </div>
          {mainnetFeeds.length ? (
            mainnetFeeds.map((network) => (
              <MainnetTable
                selectedFeedCategories={
                  Array.isArray(selectedFeedCategories)
                    ? selectedFeedCategories
                    : selectedFeedCategories
                      ? [selectedFeedCategories]
                      : []
                }
                network={network}
                showExtraDetails={showExtraDetails}
                showOnlySVR={showOnlySVR}
                dataFeedType={dataFeedType}
                ecosystem={ecosystem}
                lastAddr={lastAddr}
                firstAddr={firstAddr}
                addrPerPage={addrPerPage}
                currentPage={Number(currentPage)}
                paginate={paginate}
                searchValue={typeof searchValue === "string" ? searchValue : ""}
              />
            ))
          ) : (
            <p>No Mainnet feeds available.</p>
          )}
        </SectionWrapper>

        <SectionWrapper title={streamsTestnetSectionTitle} depth={2}>
          {testnetFeeds.length ? (
            testnetFeeds.map((network) => (
              <TestnetTable network={network} showExtraDetails={showExtraDetails} dataFeedType={dataFeedType} />
            ))
          ) : (
            <p>No Testnet feeds available.</p>
          )}
        </SectionWrapper>
      </>
    )
  }

  return (
    <SectionWrapper title="Networks" depth={2} updateTOC={false}>
      <NetworkSelectionUpdater />

      {!isDeprecating && (
        <>
          <div class={feedList.clChainnavProduct} role="tablist">
            {chains
              .filter((chain) => {
                if (isStreams) return chain.tags?.includes("streams")
                if (isSmartData) return chain.tags?.includes("smartData")
                if (isRates) return chain.tags?.includes("rates")
                return chain.tags?.includes("default")
              })
              .map((chain) => {
                // Get network directly from URL
                const urlNetworkParam =
                  typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("network") : null

                // Consider selected if either state or URL parameter matches
                const isSelected = chain.page === (urlNetworkParam || currentNetwork)

                return (
                  <button
                    key={chain.page}
                    id={chain.page}
                    role="tab"
                    aria-selected={isSelected}
                    class={clsx(feedList.networkSwitchButton, "network-button")}
                    onClick={() => handleNetworkSelect(chain)}
                  >
                    <img src={chain.img} title={chain.label} loading="lazy" width={32} height={32} />
                    <span>{chain.label}</span>
                  </button>
                )
              })}
          </div>
          {chainMetadata.processedData?.networkStatusUrl && !isDeprecating && (
            <p>
              Track the status of this network at{" "}
              <a href={chainMetadata.processedData?.networkStatusUrl}>
                {chainMetadata.processedData?.networkStatusUrl}
              </a>
            </p>
          )}
        </>
      )}

      {chainMetadata.error && <p>There was an error loading the feeds...</p>}

      {chainMetadata.loading && !chainMetadata.processedData && <p>Loading...</p>}

      {chainMetadata.processedData?.networks
        .filter((network: { metadata: unknown[]; tags: string | string[] }) => {
          if (isDeprecating) {
            let foundDeprecated = false
            network.metadata?.forEach((feed: { docs: { shutdownDate: unknown } }) => {
              if (feed.docs?.shutdownDate) {
                foundDeprecated = true
                netCount++
              }
            })
            return foundDeprecated
          }

          if (isStreams) return network.tags?.includes("streams")

          if (isSmartData) return network.tags?.includes("smartData")

          if (isRates) return network.tags?.includes("rates")

          return true
        })
        .map((network: ChainNetwork) => {
          return (
            <>
              <SectionWrapper title={network.name} depth={3} key={network.name}>
                {network.networkType === "mainnet" ? (
                  <>
                    {!isStreams && chain.l2SequencerFeed && (
                      <p>
                        {network.name} is an L2 network. As a best practice, use the L2 sequencer feed to verify the
                        status of the sequencer when running applications on L2 networks. See the{" "}
                        <a href="/docs/data-feeds/l2-sequencer-feeds/">L2 Sequencer Uptime Feeds</a> page for examples.
                      </p>
                    )}
                    {network.name === "Aptos Mainnet" && (
                      <>
                        <p>
                          Chainlink Data Feeds on Aptos provides data through a single price feed contract that handles
                          multiple data feeds. You interact with this contract by passing the specific feed ID(s) for
                          the data you need. For more details, refer to the{" "}
                          <a href="/data-feeds/aptos/">Using Data Feeds on Aptos</a> guide.
                        </p>
                        <p>
                          Price feed contract on Aptos Mainnet:{" "}
                          <a
                            className={tableStyles.addressLink}
                            href="https://explorer.aptoslabs.com/object/0x3f985798ce4975f430ef5c75776ff98a77b9f9d0fb38184d225adc9c1cc6b79b?network=mainnet"
                            target="_blank"
                          >
                            0x3f985798ce4975f430ef5c75776ff98a77b9f9d0fb38184d225adc9c1cc6b79b
                          </a>
                          <button
                            className={clsx(tableStyles.copyBtn, "copy-iconbutton")}
                            style={{ height: "16px", width: "16px", marginLeft: "5px" }}
                            data-clipboard-text="0x3f985798ce4975f430ef5c75776ff98a77b9f9d0fb38184d225adc9c1cc6b79b"
                          >
                            <img src="/assets/icons/copyIcon.svg" alt="copy to clipboard" />
                          </button>
                        </p>
                      </>
                    )}
                    <div className={feedList.tableFilters}>
                      {!isStreams && !isSmartData && (
                        <details class={feedList.filterDropdown_details}>
                          <summary class="text-200" onClick={() => setShowCategoriesDropdown((prev) => !prev)}>
                            Data Feed Categories
                          </summary>
                          <nav ref={wrapperRef} style={!showCategoriesDropdown ? { display: "none" } : {}}>
                            <ul>
                              {dataFeedCategory.map((category) => (
                                <li>
                                  <button onClick={() => handleCategorySelection(category.key)}>
                                    <input
                                      type="checkbox"
                                      checked={selectedFeedCategories?.includes(category.key)}
                                      readonly
                                      style="cursor:pointer;"
                                    />
                                    <span> {category.name}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </nav>
                        </details>
                      )}
                      {isSmartData && (
                        <details class={feedList.filterDropdown_details}>
                          <summary class="text-200" onClick={() => setShowCategoriesDropdown((prev) => !prev)}>
                            SmartData Type
                          </summary>
                          <nav ref={wrapperRef} style={!showCategoriesDropdown ? { display: "none" } : {}}>
                            <ul>
                              {smartDataTypes.map((category) => (
                                <li>
                                  <button onClick={() => handleCategorySelection(category.key)}>
                                    <input
                                      type="checkbox"
                                      checked={selectedFeedCategories?.includes(category.key)}
                                      readonly
                                      style="cursor:pointer;"
                                    />
                                    <span> {category.name}</span>
                                  </button>
                                </li>
                              ))}
                            </ul>
                          </nav>
                        </details>
                      )}
                      <form class={feedList.filterDropdown_search}>
                        <input
                          id="search"
                          class={feedList.filterDropdown_searchInput}
                          placeholder="Search"
                          onInput={(event) => {
                            setSearchValue((event.target as HTMLInputElement).value)
                            setCurrentPage("1")
                          }}
                        />
                      </form>
                      {!isStreams && (
                        <div className={feedList.checkboxContainer}>
                          <label className={feedList.detailsLabel}>
                            <input
                              type="checkbox"
                              style="width:15px;height:15px;display:inline;"
                              checked={showExtraDetails}
                              onChange={() => setShowExtraDetails((old) => !old)}
                            />
                            Show more details
                          </label>
                          {!isSmartData && (
                            <label className={feedList.detailsLabel}>
                              <input
                                type="checkbox"
                                style="width:15px;height:15px;display:inline;"
                                checked={showOnlySVR}
                                onChange={() => {
                                  setShowOnlySVR((old) => !old)
                                  setCurrentPage("1")
                                }}
                              />
                              Show SVR-enabled feeds
                            </label>
                          )}
                        </div>
                      )}
                    </div>
                    <MainnetTable
                      selectedFeedCategories={
                        Array.isArray(selectedFeedCategories)
                          ? selectedFeedCategories
                          : selectedFeedCategories
                            ? [selectedFeedCategories]
                            : []
                      }
                      network={network}
                      showExtraDetails={showExtraDetails}
                      showOnlySVR={showOnlySVR}
                      dataFeedType={dataFeedType}
                      ecosystem={ecosystem}
                      lastAddr={lastAddr}
                      firstAddr={firstAddr}
                      addrPerPage={addrPerPage}
                      currentPage={Number(currentPage)}
                      paginate={paginate}
                      searchValue={typeof searchValue === "string" ? searchValue : ""}
                    />
                  </>
                ) : (
                  <>
                    {network.name === "Aptos Testnet" && (
                      <>
                        <p>
                          Price feed contract on Aptos Testnet:{" "}
                          <a
                            className={tableStyles.addressLink}
                            href="https://explorer.aptoslabs.com/object/0xf1099f135ddddad1c065203431be328a408b0ca452ada70374ce26bd2b32fdd3/transactions?network=testnet"
                            target="_blank"
                          >
                            0xf1099f135ddddad1c065203431be328a408b0ca452ada70374ce26bd2b32fdd3
                          </a>
                          <button
                            className={clsx(tableStyles.copyBtn, "copy-iconbutton")}
                            style={{ height: "16px", width: "16px", marginLeft: "5px" }}
                            data-clipboard-text="0xf1099f135ddddad1c065203431be328a408b0ca452ada70374ce26bd2b32fdd3"
                          >
                            <img src="/assets/icons/copyIcon.svg" alt="copy to clipboard" />
                          </button>
                        </p>
                      </>
                    )}
                    {!isStreams && (
                      <label>
                        <input
                          type="checkbox"
                          style="width:15px;height:15px;display:inline;"
                          checked={showExtraDetails}
                          onChange={() => setShowExtraDetails((old) => !old)}
                        />{" "}
                        Show more details
                      </label>
                    )}
                    <TestnetTable network={network} showExtraDetails={showExtraDetails} dataFeedType={dataFeedType} />
                  </>
                )}
              </SectionWrapper>
            </>
          )
        })}
      {isDeprecating && netCount === 0 && (
        <div>
          <strong>No data feeds are scheduled for deprecation at this time.</strong>
        </div>
      )}
    </SectionWrapper>
  )
}
