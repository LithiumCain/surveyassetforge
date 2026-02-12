<ModalFrame
  id="editEquipmentModal"
  footerPadding="8px 12px"
  headerPadding="8px 12px"
  hidden={true}
  hideOnEscape={true}
  isHiddenOnMobile={true}
  overlayInteraction={true}
  padding="8px 12px"
  showFooter={true}
  showHeader={true}
  showOverlay={true}
  size="medium"
>
  <Header>
    <Text
      id="editEquipmentTitle"
      value="Edit Equipment"
      verticalAlign="center"
    />
  </Header>
  <Body>
    <Select
      id="editEquipmentTypeSelect"
      allowDeselect={true}
      data="{{ [{ label: 'Receiver', value: 'Receiver' }, { label: 'GNSS', value: 'GNSS' }, { label: 'Tablet', value: 'Tablet' }, { label: 'Radio', value: 'Radio' }, { label: 'Accessories', value: 'Accessories' }] }}"
      emptyMessage="No options"
      label="Equipment Type"
      labelPosition="top"
      labels="{{ item.label }}"
      overlayMaxHeight={375}
      placeholder="Select equipment type"
      showClear={true}
      showSelectionIndicator={true}
      value="{{ equipmentTable.selectedSourceRow?.equipmentType }}"
      values="{{ item.value }}"
    >
      <Option id="00030" value="Option 1" />
      <Option id="00031" value="Option 2" />
      <Option id="00032" value="Option 3" />
    </Select>
    <TextInput
      id="editItemNameInput"
      label="Item Name"
      labelPosition="top"
      placeholder="Enter item name"
      value="{{ equipmentTable.selectedSourceRow?.itemName }}"
    />
    <TextInput
      id="editAssetNumberInput"
      label="Asset Number"
      labelPosition="top"
      placeholder="Enter asset number"
      value="{{ equipmentTable.selectedSourceRow?.assetNumber }}"
    />
    <TextInput
      id="editPartNumberInput"
      disabled={true}
      label="Part Number"
      labelPosition="top"
      placeholder="Auto-populated"
      value="{{ equipmentTable.selectedSourceRow?.partNumber }}"
    />
    <TextInput
      id="editSerialNumberInput"
      disabled={true}
      label="Serial Number"
      labelPosition="top"
      placeholder="Auto-populated"
      value="{{ equipmentTable.selectedSourceRow?.serialNumber }}"
    />
    <TextInput
      id="editFirmwareInput"
      label="Firmware Version"
      labelPosition="top"
      maxLength={128}
      placeholder="Enter firmware (max 128 characters)"
      value="{{ equipmentTable.selectedSourceRow?.firmware }}"
    />
    <TextInput
      id="editAssignedNameInput"
      label="Assigned To (Name)"
      labelPosition="top"
      maxLength={64}
      placeholder="Enter name (max 64 characters)"
      value="{{ equipmentTable.selectedSourceRow?.assignedName }}"
    />
    <TextInput
      id="editEmployeeNumberInput"
      label="Employee Number"
      labelPosition="top"
      placeholder="Enter 10-digit employee number"
      value="{{ equipmentTable.selectedSourceRow?.employeeNumber }}"
    />
    <Select
      id="editCalibrationSelect"
      data="{{ [{ label: 'Yes', value: 'Yes' }, { label: 'No', value: 'No' }] }}"
      emptyMessage="No options"
      label="Calibration Required"
      labelPosition="top"
      labels="{{ item.label }}"
      overlayMaxHeight={375}
      placeholder="Select Yes or No"
      searchMode="caseInsensitive"
      showSelectionIndicator={true}
      value="{{ equipmentTable.selectedSourceRow?.calibration }}"
      values="{{ item.value }}"
    />
  </Body>
  <Footer>
    <Button id="cancelEditButton" styleVariant="outline" text="Cancel">
      <Event
        id="b2e8cb4a"
        event="click"
        method="run"
        params={{ map: { src: "editEquipmentModal.setHidden(true)" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
    <Button id="updateEquipmentButton" text="Update">
      <Event
        id="2d18f0fe"
        event="click"
        method="run"
        params={{ map: { src: "updateEquipmentScript.trigger()" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Button>
  </Footer>
</ModalFrame>
