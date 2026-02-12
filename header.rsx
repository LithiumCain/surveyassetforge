<Frame
  id="$header"
  enableFullBleed={null}
  isHiddenOnDesktop={false}
  isHiddenOnMobile={true}
  padding="8px 12px"
  sticky={true}
  type="header"
>
  <Navigation
    id="mainNav"
    data={
      '{{ [ { id: "page1", label: "Site Level", screenTargetId: "page1", itemType: "page" }, { id: "adminDashboard", label: "Dashboard", screenTargetId: "adminDashboard", itemType: "page" }, { id: "siteDashboard", label: "Site Level Dashboard", screenTargetId: "siteDashboard", itemType: "page" } ] }}'
    }
    labels="{{ item.label }}"
  >
    <Option id="0000" itemType="page" label="Site Level" screenTargetId="page1">
      <Event
        id="d21672b9"
        event="click"
        method="run"
        params={{ map: { src: "utils.openPage(item.id, {})" } }}
        pluginId=""
        type="script"
        waitMs="0"
        waitType="debounce"
      />
    </Option>
    <Option
      id="0001"
      itemType="page"
      label="Dashboard"
      screenTargetId="adminDashboard"
    />
    <Option
      id="0002"
      itemType="page"
      label="Site Level Dashboard"
      screenTargetId="siteDashboard"
    />
  </Navigation>
</Frame>
