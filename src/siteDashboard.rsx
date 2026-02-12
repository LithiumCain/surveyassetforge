<Screen
  id="siteDashboard"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={2}
  _searchParams={[]}
  browserTitle="Site Dashboard"
  title="Site Dashboard"
  urlSlug="site-dashboard"
  uuid="01bf2aa8-a8ce-4f91-b24c-7fd03f7a1aa7"
>
  <Function
    id="filteredCalibData"
    funcBody={include("../lib/filteredCalibData.js", "string")}
  />
  <Function
    id="endOfLifeNotification"
    funcBody={include("../lib/endOfLifeNotification.js", "string")}
  />
  <JavascriptQuery
    id="clearCalibFiltersScript"
    notificationDuration={4.5}
    query={include("../lib/clearCalibFiltersScript.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <Frame
    id="$main3"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    sticky={null}
    type="main"
  >
    <Text
      id="dashboardTitle2"
      value="# Site Level Dashboard - Calibration Status"
      verticalAlign="center"
    />
    <Container
      id="filterContainer2"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
    >
      <View id="00030" viewKey="View 1">
        <Select
          id="equipmentTypeFilter"
          emptyMessage="No options"
          label="Equipment Type"
          labelPosition="top"
          overlayMaxHeight={375}
          placeholder="Filter by type"
          showSelectionIndicator={true}
        >
          <Option id="00030" value="Option 1" />
          <Option id="00031" value="Option 2" />
          <Option id="00032" value="Option 3" />
        </Select>
        <Select
          id="calibrationStatusFilter"
          emptyMessage="No options"
          label="Calibration Status"
          labelPosition="top"
          overlayMaxHeight={375}
          placeholder="Filter by status"
          showSelectionIndicator={true}
        >
          <Option id="00030" value="Option 1" />
          <Option id="00031" value="Option 2" />
          <Option id="00032" value="Option 3" />
        </Select>
        <Button id="clearFiltersButton2" styleVariant="outline" text="Clear">
          <Event
            id="487fa53e"
            event="click"
            method="run"
            params={{ map: { src: "clearCalibFiltersScript.trigger()" } }}
            pluginId=""
            type="script"
            waitMs="0"
            waitType="debounce"
          />
        </Button>
      </View>
    </Container>
    <Include src="./kpiContainer.rsx" />
    <Container
      id="equipmentTableContainer3"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      showHeader={true}
      style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
    >
      <Header>
        <Text
          id="tableHeaderText2"
          value="**tableHeaderText**"
          verticalAlign="center"
        />
      </Header>
      <View id="00030" viewKey="View 1">
        <Table
          id="calibrationTrackingTable"
          cellSelection="none"
          clearChangesetOnSave={true}
          data="{{ filteredCalibData.value }}"
          defaultSelectedRow={{ mode: "none", indexType: "display", index: 0 }}
          emptyMessage="No rows found"
          enableSaveActions={true}
          primaryKeyColumnId="a322e"
          rowHeight="medium"
          showBorder={true}
          showFooter={true}
          showHeader={true}
          style={{ rowSeparator: "surfacePrimaryBorder" }}
          toolbarPosition="bottom"
        >
          <Column
            id="c3cf7"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="equipmentType"
            label="Equipment Type"
            position="center"
            referenceId="equipmentType"
            size={180}
            summaryAggregationMode="none"
          />
          <Column
            id="a322e"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="assetNumber"
            label="Asset Number"
            position="center"
            referenceId="assetNumber"
            size={160}
            summaryAggregationMode="none"
          />
          <Column
            id="2925f"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="assignedName"
            label="Assigned Name"
            position="center"
            referenceId="assignedName"
            size={200}
            summaryAggregationMode="none"
          />
          <Column
            id="47bad"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="employeeNumber"
            label="Employee Number"
            position="center"
            referenceId="employeeNumber"
            size={160}
            summaryAggregationMode="none"
          />
          <Column
            id="9e8c7"
            alignment="right"
            backgroundColor="{{ currentSourceRow.daysUntilCalibration <= 20 ? theme.success : currentSourceRow.daysUntilCalibration <= 30 ? '#FFA500' : currentSourceRow.daysUntilCalibration <= 45 ? theme.danger : currentSourceRow.daysUntilCalibration <= 60 ? '#FFFF00' : currentSourceRow.daysUntilCalibration <= 75 ? theme.danger : '' }}"
            editableOptions={{ showStepper: true }}
            format="decimal"
            formatOptions={{ showSeparators: false }}
            groupAggregationMode="none"
            key="daysUntilCalibration"
            label="Calibration"
            position="center"
            referenceId="calibration"
            size={140}
            summaryAggregationMode="none"
            textColor="{{ currentSourceRow.daysUntilCalibration <= 60 ? '' : currentSourceRow.daysUntilCalibration <= 75 ? '#FFFF00' : '' }}"
            valueOverride="{{ currentSourceRow.daysUntilCalibration }}"
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
              id="608dafe2"
              event="clickToolbar"
              method="exportData"
              pluginId="calibrationTrackingTable"
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
              id="d7b49162"
              event="clickToolbar"
              method="refresh"
              pluginId="calibrationTrackingTable"
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
