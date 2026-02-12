<Screen
  id="adminDashboard"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={1}
  _searchParams={[]}
  browserTitle="Admin Dashboard"
  title="Admin Dashboard"
  urlSlug="admin-dashboard"
  uuid="c86ffe05-dfa8-474f-8d16-56fd3bd64205"
>
  <Function
    id="filteredAdminData"
    funcBody={include("../lib/filteredAdminData.js", "string")}
  />
  <JavascriptQuery
    id="clearAdminFiltersScript"
    notificationDuration={4.5}
    query={include("../lib/clearAdminFiltersScript.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <Frame
    id="$main2"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Text id="dashboardTitle" value="# Dashboard" verticalAlign="center" />
    <Container
      id="filterContainer"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
    >
      <View id="00030" viewKey="View 1">
        <TextInput
          id="siteSearchInput"
          label="Search Sites"
          labelPosition="top"
          placeholder="Enter site name"
        />
        <Select
          id="vendorFilterSelect"
          emptyMessage="No options"
          label="Vendor"
          labelPosition="top"
          overlayMaxHeight={375}
          placeholder="Filter by vendor"
          showSelectionIndicator={true}
        >
          <Option id="00030" value="Option 1" />
          <Option id="00031" value="Option 2" />
          <Option id="00032" value="Option 3" />
        </Select>
        <Button id="clearFiltersButton" styleVariant="outline" text="Clear">
          <Event
            id="ea6d8bef"
            event="click"
            method="run"
            params={{ map: { src: "clearAdminFiltersScript.trigger()" } }}
            pluginId=""
            type="script"
            waitMs="0"
            waitType="debounce"
          />
        </Button>
      </View>
    </Container>
    <Include src="./kpiMetricsContainer.rsx" />
    <Container
      id="equipmentTableContainer2"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      showHeader={true}
      style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
    >
      <Header>
        <Text
          id="tableHeaderText"
          value="### Equipment Calibration Tracking"
          verticalAlign="center"
        />
      </Header>
      <View id="00030" viewKey="View 1">
        <Table
          id="equipmentFinancialTable"
          cellSelection="none"
          clearChangesetOnSave={true}
          data="{{ filteredAdminData.value }}"
          defaultSelectedRow={{ mode: "none", indexType: "display", index: 0 }}
          emptyMessage="No rows found"
          enableSaveActions={true}
          primaryKeyColumnId="99466"
          rowHeight="medium"
          showBorder={true}
          showFooter={true}
          showHeader={true}
          style={{ rowSeparator: "surfacePrimaryBorder" }}
          toolbarPosition="bottom"
        >
          <Column
            id="99466"
            alignment="right"
            format="decimal"
            groupAggregationMode="countDistinct"
            hidden="true"
            key="id"
            label="ID"
            position="center"
            size={80}
            summaryAggregationMode="none"
          />
          <Column
            id="e7b78"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="site"
            label="Site"
            position="center"
            referenceId="site"
            size={160}
            summaryAggregationMode="none"
          />
          <Column
            id="634e5"
            alignment="left"
            format="date"
            groupAggregationMode="none"
            key="acquiredDate"
            label="Acquired"
            placeholder="Select option"
            position="center"
            referenceId="acquiredDate"
            size={120}
            summaryAggregationMode="none"
          />
          <Column
            id="e2d57"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="vendor"
            label="Vendor"
            position="center"
            referenceId="vendor"
            size={160}
            summaryAggregationMode="none"
          />
          <Column
            id="d1e0e"
            alignment="right"
            editableOptions={{ showStepper: true }}
            format="currency"
            formatOptions={{
              showSeparators: true,
              decimalPlaces: 2,
              currency: "USD",
              currencySign: "standard",
              currencyDisplay: "symbol",
            }}
            groupAggregationMode="none"
            key="cost"
            label="Cost"
            position="center"
            referenceId="cost"
            size={120}
            summaryAggregationMode="none"
          />
          <Column
            id="ff6e6"
            alignment="right"
            cellTooltipMode="overflow"
            editableOptions={{ showStepper: true }}
            format="currency"
            formatOptions={{
              showSeparators: true,
              decimalPlaces: 2,
              currency: "USD",
              currencySign: "standard",
              currencyDisplay: "symbol",
            }}
            groupAggregationMode="none"
            key="currentValue"
            label="Current Value"
            placeholder="Select options"
            position="center"
            referenceId="currentValue"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="50e20"
            alignment="right"
            editableOptions={{ showStepper: true }}
            format="currency"
            formatOptions={{
              showSeparators: true,
              decimalPlaces: 2,
              currency: "USD",
              currencySign: "standard",
              currencyDisplay: "symbol",
            }}
            groupAggregationMode="none"
            key="replacementCost"
            label="Replacement"
            position="center"
            referenceId="replacementCost"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="b3229"
            alignment="left"
            cellTooltipMode="overflow"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="calibration"
            label="Calibration"
            position="center"
            referenceId="calibration"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="4bdb9"
            alignment="left"
            format="date"
            groupAggregationMode="none"
            key="endOfLife"
            label="End of Life"
            position="center"
            referenceId="endOfLife"
            size={140}
            summaryAggregationMode="none"
          />
          <ToolbarButton
            id="1a"
            icon="bold/interface-text-formatting-filter-2"
            label="Filter"
            type="filter"
          />
          <ToolbarButton
            id="3c"
            icon="bold/interface-download-button-2"
            label="Download"
            type="custom"
          >
            <Event
              id="8a50ca0a"
              event="clickToolbar"
              method="exportData"
              pluginId="equipmentFinancialTable"
              type="widget"
              waitMs="0"
              waitType="debounce"
            />
          </ToolbarButton>
          <ToolbarButton
            id="4d"
            icon="bold/interface-arrows-round-left"
            label="Refresh"
            type="custom"
          >
            <Event
              id="afff29fc"
              event="clickToolbar"
              method="refresh"
              pluginId="equipmentFinancialTable"
              type="widget"
              waitMs="0"
              waitType="debounce"
            />
          </ToolbarButton>
        </Table>
      </View>
    </Container>
  </Frame>
</Screen>
