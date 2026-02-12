<Screen
  id="page1"
  _customShortcuts={[]}
  _hashParams={[]}
  _order={0}
  _searchParams={[]}
  browserTitle=""
  title="Page 1"
  urlSlug=""
  uuid="1177c871-a39e-4b80-bbe3-f6ac0c8ecbfe"
>
  <JavascriptQuery
    id="saveEquipmentScript"
    notificationDuration={4.5}
    query={include("../lib/saveEquipmentScript.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <JavascriptQuery
    id="updateEquipmentScript"
    notificationDuration={4.5}
    query={include("../lib/updateEquipmentScript.js", "string")}
    resourceName="JavascriptQuery"
    showSuccessToaster={false}
  />
  <Include src="./addEquipmentModal.rsx" />
  <Include src="./editEquipmentModal.rsx" />
  <Frame
    id="$main"
    enableFullBleed={false}
    isHiddenOnDesktop={false}
    isHiddenOnMobile={false}
    padding="8px 12px"
    type="main"
  >
    <Text id="pageTitleText" value="# Site Level" verticalAlign="center" />
    <Button id="addEquipmentButton" text="Add Equipment">
      <Event
        id="91036285"
        event="click"
        method="run"
        params={{ map: { src: "addEquipmentModal.setHidden(false)" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <Container
      id="equipmentTableContainer"
      footerPadding="4px 12px"
      headerPadding="4px 12px"
      padding="12px"
      showBody={true}
      style={{ border: "surfacePrimaryBorder", borderRadius: "8px" }}
    >
      <View id="00030" viewKey="View 1">
        <Table
          id="equipmentTable"
          actionsOverflowPosition={1}
          cellSelection="none"
          clearChangesetOnSave={true}
          data="{{ equipmentData.value.filter(item => item.site === currentUser.value?.siteName) }}"
          defaultSelectedRow={{ mode: "none", indexType: "display", index: 0 }}
          emptyMessage="No rows found"
          enableSaveActions={true}
          primaryKeyColumnId="86e98"
          rowHeight="medium"
          showBorder={true}
          showFooter={true}
          showHeader={true}
          style={{ rowSeparator: "surfacePrimaryBorder" }}
          toolbarPosition="bottom"
        >
          <Column
            id="d2569"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="equipmentType"
            label="Equipment Type"
            position="center"
            referenceId="equipmentType"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="590c8"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="itemName"
            label="Item"
            position="center"
            referenceId="itemName"
            size={220}
            summaryAggregationMode="none"
          />
          <Column
            id="86e98"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="assetNumber"
            label="Asset Number"
            position="center"
            referenceId="assetNumber"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="391fb"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="partNumber"
            label="Part Number"
            position="center"
            referenceId="partNumber"
            size={140}
            summaryAggregationMode="none"
          />
          <Column
            id="5ddce"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="serialNumber"
            label="Serial Number"
            position="center"
            referenceId="serialNumber"
            size={180}
            summaryAggregationMode="none"
          />
          <Column
            id="ee60b"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="firmware"
            label="Firmware"
            position="center"
            referenceId="firmware"
            size={120}
            summaryAggregationMode="none"
          />
          <Column
            id="ee24a"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="assignedName"
            label="Assigned To"
            position="center"
            referenceId="assignedName"
            size={200}
            summaryAggregationMode="none"
          />
          <Column
            id="2a054"
            alignment="left"
            editableOptions={{ spellCheck: false }}
            format="string"
            groupAggregationMode="none"
            key="employeeNumber"
            label="Employee #"
            position="center"
            referenceId="employeeNumber"
            size={120}
            summaryAggregationMode="none"
          />
          <Column
            id="f5c9e"
            alignment="left"
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
          <Action id="48402" icon="line/interface-edit-write-1" label="Edit">
            <Event
              id="e7e59ae0"
              event="clickAction"
              method="run"
              params={{ map: { src: "editEquipmentModal.setHidden(false)" } }}
              pluginId=""
              type="script"
              waitMs="0"
              waitType="debounce"
            />
          </Action>
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
              id="d5f7aa98"
              event="clickToolbar"
              method="exportData"
              pluginId="equipmentTable"
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
              id="1357f15e"
              event="clickToolbar"
              method="refresh"
              pluginId="equipmentTable"
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
