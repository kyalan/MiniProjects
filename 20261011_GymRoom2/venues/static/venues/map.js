(function () {
  const body = document.body;
  const i18n = JSON.parse(document.getElementById("i18n-data").textContent);
  const venuesUrl = body.dataset.venues;
  const detailPattern = body.dataset.detail;
  const syncUrl = body.dataset.sync;
  const statusUrl = body.dataset.status;
  const csrf = body.dataset.csrf;
  const listEl = document.getElementById("list");
  const countEl = document.getElementById("result-count");
  const searchEl = document.getElementById("search");
  const districtEl = document.getElementById("district");
  const regionEl = document.getElementById("region");
  const accessibleEl = document.getElementById("accessible");
  const openNowEl = document.getElementById("open-now");
  const equipmentEl = document.getElementById("equipment-category");
  const updateBtn = document.getElementById("update-btn");
  const stateEl = document.getElementById("sync-state");
  const updatedEl = document.getElementById("updated");
  const logEl = document.getElementById("sync-log");
  const drawer = document.getElementById("drawer");
  const langForm = document.getElementById("lang-form");
  const locationNote = document.getElementById("location-note");
  const nearMeBtn = document.getElementById("near-me");

  const statusLabels = {
    queued: i18n.queued,
    running: i18n.running,
    success: i18n.succeeded,
    failed: i18n.failed,
  };
  const slotLabels = {
    A: i18n.available,
    P: i18n.programme,
    T: i18n.training,
    B: i18n.blockBooking,
    M: i18n.maintenance,
    S: i18n.sessionalBreak,
  };
  const regionLabels = {
    hk_island: i18n.regionIsland,
    kowloon: i18n.regionKowloon,
    nt: i18n.regionNt,
  };
  const errorLabels = {
    not_published: i18n.notPublished,
    parse_failed: i18n.parseFailed,
    download_failed: i18n.downloadFailed,
  };
  const categoryOrder = [
    "treadmill", "bike", "elliptical", "rowing", "free_weights",
    "upper_body", "lower_body", "core", "cable", "other",
  ];
  const categoryLabels = {
    treadmill: i18n.categoryTreadmill,
    bike: i18n.categoryBike,
    elliptical: i18n.categoryElliptical,
    rowing: i18n.categoryRowing,
    free_weights: i18n.categoryFreeWeights,
    upper_body: i18n.categoryUpperBody,
    lower_body: i18n.categoryLowerBody,
    core: i18n.categoryCore,
    cable: i18n.categoryCable,
    other: i18n.categoryOther,
  };
  const equipmentIcons = {
    treadmill: '<path d="M3 17h18M5 17v2M19 17v2M6 17l3-7h7l3 4M8 8h6"/><circle cx="8.5" cy="6" r="1.2"/>',
    bike: '<circle cx="7" cy="16" r="3"/><circle cx="17" cy="16" r="3"/><path d="M7 16l3.5-7h4L17 16M10.5 9l2.2 7"/>',
    elliptical: '<path d="M4 18c4-2 8-2 12 0M7 17l2-8h4l5 5M9 7h5"/><circle cx="8" cy="5.5" r="1.2"/>',
    rowing: '<path d="M3 17h16M8 14l4-5h4M16 9v7M4 8h3"/><circle cx="8" cy="15.5" r="1.6"/>',
    dumbbell: '<path d="M8 12h8M4 9v6M6.5 7.5v9M17.5 7.5v9M20 9v6"/>',
    barbell: '<path d="M2 12h20M5 8v8M8 9.5v5M16 9.5v5M19 8v8"/>',
    bench: '<path d="M3 14h13l5-4M6 14v5M13 14v5"/>',
    kettlebell: '<path d="M9 9.5a3 3 0 0 1 6 0M8.5 11.5h7"/><circle cx="12" cy="16" r="4"/>',
    free_weights: '<path d="M8 12h8M4 9v6M6.5 7.5v9M17.5 7.5v9M20 9v6"/>',
    upper_body: '<path d="M8 18V7h8v11M4 12h4M16 12h4M8 18h8"/>',
    lower_body: '<path d="M4 16h9l7-7M7 16v4M12 16v4M15 7l3 3"/>',
    core: '<circle cx="6" cy="8" r="1.3"/><path d="M7 9.2c2.2 1.6 4.2 2.2 7 .8M4 15c3.2 2.4 8 2.6 13-1.2"/>',
    cable: '<circle cx="7" cy="5.5" r="2"/><path d="M7 7.5V19M7 12h8M15 12v7"/>',
    other: '<rect x="5" y="6" width="14" height="12" rx="2"/><path d="M8 10h8M8 14h5"/>',
  };
  const gymSvg = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="glyph" d="M4 8H2v8h2v3h2V5H4v3zm16 0v-3h-2v14h2v-3h2V8h-2zM7 11h10v2H7z"/></svg>';

  for (const key of categoryOrder) {
    const option = document.createElement("option");
    option.value = key;
    option.textContent = categoryLabels[key];
    equipmentEl.appendChild(option);
  }

  function equipmentSvg(key) {
    const body = equipmentIcons[key] || equipmentIcons.other;
    return '<svg viewBox="0 0 24 24" aria-hidden="true">' + body + "</svg>";
  }

  function equipmentIconEl(key) {
    const icon = document.createElement("span");
    icon.className = "equip-icon";
    icon.innerHTML = equipmentSvg(key);
    return icon;
  }

  let venues = [];
  let selectedId = null;
  let markerById = {};
  let shownKey = "";
  let polling = false;
  let userPoint = null;
  let userCircle = null;
  let userDot = null;
  let locationPending = true;
  let skipNextFit = false;

  const map = L.map("map", { scrollWheelZoom: true, maxZoom: 19 }).setView([22.35, 114.15], 11);
  maplibregl.setWorkerUrl(body.dataset.mapWorker);
  L.maplibreGL({
    style: "https://tiles.openfreemap.org/styles/positron",
    interactive: false,
  }).addTo(map);
  const cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    maxClusterRadius: 42,
    iconCreateFunction: function (group) {
      const children = group.getAllChildMarkers();
      let sets = 0;
      let hasSets = false;
      for (const marker of children) {
        if (marker.options.equipmentSets != null) {
          hasSets = true;
          sets += marker.options.equipmentSets;
        }
      }
      const count = hasSets ? sets : group.getChildCount();
      const size = count < 10 ? "small" : count < 100 ? "medium" : "large";
      return L.divIcon({
        html: "<div><span>" + count + "</span></div>",
        className: "marker-cluster marker-cluster-" + size,
        iconSize: [40, 40],
      });
    },
  });
  map.addLayer(cluster);

  function esc(value) {
    return String(value ?? "").replace(/[&<>"']/g, function (char) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
    });
  }

  function localeTag() {
    const lang = document.documentElement.lang || "zh-Hant";
    if (lang === "zh-hant") return "zh-Hant";
    if (lang === "zh-hans") return "zh-Hans";
    return "en";
  }

  function formatTime(iso) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    return date.toLocaleString(localeTag(), { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  function detailUrl(id) {
    return detailPattern.replace("999999", String(id));
  }

  function availability(venue) {
    if (venue.open_now) return i18n.availableNow;
    if (venue.current_status && slotLabels[venue.current_status]) return slotLabels[venue.current_status];
    return i18n.unknownAvailability;
  }

  function iconPixels(area) {
    const roots = [];
    for (const venue of venues) {
      if (venue.area_sqm > 0) roots.push(Math.sqrt(venue.area_sqm));
    }
    if (!(area > 0) || !roots.length) return 36;
    const value = Math.sqrt(area);
    const min = Math.min.apply(null, roots);
    const max = Math.max.apply(null, roots);
    if (max === min) return 40;
    return Math.round(28 + ((value - min) / (max - min)) * 24);
  }

  function pin(venue) {
    const px = iconPixels(venue.area_sqm);
    const tone = venue.horizon === "open" || venue.horizon === "soon" ? venue.horizon : "other";
    const sets = categorySets(venue);
    const badge = sets == null ? "" : '<span class="pin-count">' + sets + "</span>";
    return L.divIcon({
      className: "gym-pin pin-" + tone,
      html: gymSvg + badge,
      iconSize: [px, px],
      iconAnchor: [px / 2, px / 2],
      popupAnchor: [0, Math.round(-px / 2)],
    });
  }

  function metresTo(venue) {
    if (!userPoint || venue.lat == null || venue.lng == null) return Number.POSITIVE_INFINITY;
    return map.distance(userPoint, L.latLng(venue.lat, venue.lng));
  }

  function formatDistance(metres) {
    if (!Number.isFinite(metres)) return "";
    if (metres < 1000) return Math.round(metres) + " " + i18n.metres;
    const kilometres = metres / 1000;
    const digits = kilometres < 10 ? 1 : 0;
    return kilometres.toFixed(digits) + " " + i18n.kilometres;
  }

  function ordered(items) {
    if (!userPoint) return items;
    return items.map(function (venue, index) {
      return { venue: venue, index: index };
    }).sort(function (a, b) {
      const difference = metresTo(a.venue) - metresTo(b.venue);
      return difference || a.index - b.index;
    }).map(function (item) { return item.venue; });
  }

  function popupHtml(venue) {
    const warning = venue.horizon === "soon" ? "<p>" + esc(i18n.soonBusy) + "</p>" : "";
    const distance = formatDistance(metresTo(venue));
    const distanceLine = distance ? "<p>" + esc(distance) + "</p>" : "";
    return (
      '<div class="popup"><strong>' + esc(venue.name) + "</strong>" +
      "<p>" + esc(venue.address) + "</p>" +
      "<p>" + esc(i18n.area) + ": " + esc(venue.area || "—") + "</p>" +
      "<p>" + esc(i18n.phone) + ": " + esc(venue.phone || "—") + "</p>" +
      "<p>" + esc(availability(venue)) + "</p>" +
      warning + distanceLine +
      '<button type="button" data-open="' + venue.id + '">' + esc(i18n.details) + "</button></div>"
    );
  }

  function filtersActive() {
    return Boolean(searchEl.value.trim() || districtEl.value || regionEl.value || equipmentEl.value || accessibleEl.checked || openNowEl.checked);
  }

  function categorySets(venue) {
    if (!equipmentEl.value) return null;
    const sets = venue.category_sets && venue.category_sets[equipmentEl.value];
    return sets || 0;
  }

  function matches(venue) {
    const query = searchEl.value.trim().toLowerCase();
    if (query) {
      const haystack = [venue.name, venue.address, venue.district, venue.phone].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (districtEl.value && venue.district !== districtEl.value) return false;
    if (regionEl.value && venue.region !== regionEl.value) return false;
    if (accessibleEl.checked && !venue.accessible) return false;
    if (openNowEl.checked && !venue.open_now) return false;
    if (equipmentEl.value && !categorySets(venue)) return false;
    return true;
  }

  function renderList(items) {
    listEl.replaceChildren();
    countEl.textContent = items.length + " " + i18n.rooms;
    if (!items.length) {
      const empty = document.createElement("p");
      empty.className = "empty";
      empty.textContent = !venues.length && !filtersActive() ? i18n.empty : i18n.noMatch;
      listEl.appendChild(empty);
      return;
    }
    for (const venue of items) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "card" + (venue.id === selectedId ? " is-selected" : "") + (venue.horizon === "open" ? " is-open-now" : "") + (venue.horizon === "soon" ? " is-soon" : "");
      card.dataset.id = String(venue.id);
      const kicker = document.createElement("span");
      kicker.className = "kicker";
      kicker.textContent = [venue.district, regionLabels[venue.region]].filter(Boolean).join(" · ");
      const name = document.createElement("strong");
      name.textContent = venue.name;
      const address = document.createElement("span");
      address.className = "address";
      address.textContent = venue.address;
      const meta = document.createElement("span");
      meta.className = "meta";
      const selectedSets = categorySets(venue);
      const equipText = selectedSets == null
        ? venue.equipment_count + " " + i18n.sets
        : categoryLabels[equipmentEl.value] + " " + selectedSets + " " + i18n.sets;
      const facts = [venue.area, venue.phone].filter(Boolean);
      meta.textContent = facts.join(" · ");
      if (facts.length) meta.append(document.createTextNode(" · "));
      if (selectedSets != null) {
        meta.append(equipmentIconEl(equipmentEl.value));
        meta.append(document.createTextNode(" "));
      }
      meta.append(document.createTextNode(equipText));
      const badge = document.createElement("span");
      badge.className = "badge" + (venue.open_now ? " open" : "");
      badge.textContent = availability(venue);
      card.append(kicker, name, address, meta, badge);
      if (venue.horizon === "soon") {
        const soon = document.createElement("span");
        soon.className = "badge soon";
        soon.textContent = i18n.soonBusy;
        card.appendChild(soon);
      }
      const distance = formatDistance(metresTo(venue));
      if (distance) {
        const away = document.createElement("span");
        away.className = "meta";
        away.textContent = distance;
        card.appendChild(away);
      }
      if (venue.accessible) {
        const shared = document.createElement("span");
        shared.className = "badge shared";
        shared.textContent = i18n.sharedUse;
        card.appendChild(shared);
      }
      if (venue.location_quality !== "ok") {
        const missing = document.createElement("span");
        missing.className = "meta";
        missing.textContent = i18n.locationUnavailable;
        card.appendChild(missing);
      }
      listEl.appendChild(card);
    }
  }

  function renderMarkers(items) {
    cluster.clearLayers();
    markerById = {};
    const bounds = [];
    for (const venue of items) {
      if (venue.lat == null || venue.lng == null) continue;
      const marker = L.marker([venue.lat, venue.lng], { icon: pin(venue), equipmentSets: categorySets(venue) });
      marker.bindPopup(popupHtml(venue));
      marker.on("click", function () { highlight(venue.id); });
      cluster.addLayer(marker);
      markerById[venue.id] = marker;
      bounds.push([venue.lat, venue.lng]);
    }
    if (!bounds.length) return;
    if (locationPending && !filtersActive()) return;
    const key = items.map(function (venue) { return venue.id; }).sort(function (a, b) { return a - b; }).join(",");
    if (key === shownKey) {
      skipNextFit = false;
      return;
    }
    shownKey = key;
    if (skipNextFit) {
      skipNextFit = false;
      return;
    }
    if (bounds.length === 1) map.setView(bounds[0], 15);
    else map.fitBounds(bounds, { padding: [36, 36], maxZoom: 15 });
  }

  function applyFilters() {
    const items = ordered(venues.filter(matches));
    renderList(items);
    renderMarkers(items);
  }

  function highlight(id) {
    selectedId = id;
    for (const card of listEl.querySelectorAll(".card")) {
      card.classList.toggle("is-selected", Number(card.dataset.id) === id);
    }
    const selected = listEl.querySelector(".card.is-selected");
    if (selected) selected.scrollIntoView({ block: "nearest" });
  }

  function safeOfficial(url) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === "https:" && parsed.hostname === "www.lcsd.gov.hk") return parsed.href;
    } catch (error) {
      return "";
    }
    return "";
  }

  function fact(label, value) {
    const wrap = document.createElement("div");
    const span = document.createElement("span");
    span.textContent = label;
    wrap.append(span, document.createTextNode(value || "—"));
    return wrap;
  }

  function renderDrawer(data) {
    drawer.replaceChildren();
    const head = document.createElement("div");
    head.className = "drawer-head";
    const titles = document.createElement("div");
    const kicker = document.createElement("p");
    kicker.className = "kicker";
    kicker.textContent = [data.district, regionLabels[data.region]].filter(Boolean).join(" · ");
    const heading = document.createElement("h2");
    heading.textContent = data.name;
    titles.append(kicker, heading);
    const close = document.createElement("button");
    close.type = "button";
    close.className = "icon-btn";
    close.id = "drawer-close";
    close.textContent = i18n.close;
    head.append(titles, close);

    const facts = document.createElement("div");
    facts.className = "facts";
    facts.append(
      fact(i18n.area, data.area),
      fact(i18n.phone, data.phone),
      fact(i18n.equipment, String(data.equipment_count)),
      fact(i18n.openingHours, availability(data))
    );
    if (data.location_quality !== "ok") facts.append(fact(i18n.locationUnavailable, "—"));

    drawer.append(head, facts);
    if (data.accessible) {
      const shared = document.createElement("p");
      shared.className = "badge shared";
      shared.textContent = i18n.sharedUse;
      drawer.appendChild(shared);
    }

    const equipTitle = document.createElement("h3");
    equipTitle.className = "section-title";
    equipTitle.textContent = i18n.fitnessEquipment;
    drawer.appendChild(equipTitle);
    const equipment = data.equipment || [];
    const multipleRooms = (data.room_numbers || []).length > 1;
    const groups = {};
    for (const item of equipment) {
      const key = categoryLabels[item.category] ? item.category : "other";
      if (!groups[key]) groups[key] = [];
      groups[key].push(item);
    }
    for (const key of categoryOrder) {
      const grouped = groups[key];
      if (!grouped || !grouped.length) continue;
      const groupTitle = document.createElement("h4");
      groupTitle.className = "equip-group";
      groupTitle.textContent = categoryLabels[key];
      const equipList = document.createElement("ul");
      equipList.className = "equipment";
      for (const item of grouped) {
        const li = document.createElement("li");
        const label = document.createElement("span");
        label.className = "equip-label";
        label.append(equipmentIconEl(item.icon || item.category || "other"));
        const name = document.createElement("span");
        name.textContent = (multipleRooms ? i18n.room + " " + item.room_no + " · " : "") + item.name;
        label.append(name);
        const qty = document.createElement("span");
        qty.textContent = item.quantity + " " + i18n.sets + (item.shared_use ? " · " + i18n.sharedUse : "");
        li.append(label, qty);
        equipList.appendChild(li);
      }
      drawer.append(groupTitle, equipList);
    }

    if ((data.rooms || []).length) {
      const roomLine = document.createElement("p");
      roomLine.className = "meta";
      roomLine.textContent = data.rooms.map(function (room) {
        return i18n.room + " " + room.room_no + (room.area ? " · " + room.area : "");
      }).join("  ");
      drawer.appendChild(roomLine);
    }

    const hoursTitle = document.createElement("h3");
    hoursTitle.className = "section-title";
    hoursTitle.textContent = i18n.openingHours;
    drawer.appendChild(hoursTitle);

    const roomNumbers = data.room_numbers || [1];
    const activeRoom = data.timetable ? data.timetable.room_no : roomNumbers[0];
    if (roomNumbers.length > 1) {
      const roomSwitch = document.createElement("div");
      roomSwitch.className = "switcher";
      for (const roomNo of roomNumbers) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = i18n.room + " " + roomNo;
        if (roomNo === activeRoom) button.className = "is-current";
        button.addEventListener("click", function () {
          openDrawer(data.id, { room: roomNo, pan: false });
        });
        roomSwitch.appendChild(button);
      }
      drawer.appendChild(roomSwitch);
    }

    const months = (data.months || []).filter(function (item) { return item.room_no === activeRoom; });
    const seen = {};
    const uniqueMonths = [];
    for (const item of months) {
      const key = item.year + "-" + item.month;
      if (seen[key]) continue;
      seen[key] = true;
      uniqueMonths.push(item);
    }
    if (uniqueMonths.length) {
      const monthSwitch = document.createElement("div");
      monthSwitch.className = "switcher";
      for (const item of uniqueMonths) {
        const button = document.createElement("button");
        button.type = "button";
        const labelDate = new Date(item.year, item.month - 1, 1);
        button.textContent = labelDate.toLocaleDateString(localeTag(), { year: "numeric", month: "long" });
        if (data.timetable && data.timetable.year === item.year && data.timetable.month === item.month) {
          button.className = "is-current";
        }
        button.addEventListener("click", function () {
          openDrawer(data.id, { year: item.year, month: item.month, room: activeRoom, pan: false });
        });
        monthSwitch.appendChild(button);
      }
      drawer.appendChild(monthSwitch);
    }

    const timetable = data.timetable;
    if (!timetable || (!timetable.rows.length && timetable.error)) {
      const message = document.createElement("p");
      message.textContent = timetable && timetable.error ? (errorLabels[timetable.error] || i18n.noTimetable) : i18n.noTimetable;
      drawer.appendChild(message);
    } else if (timetable.rows.length) {
      const quotas = document.createElement("p");
      quotas.className = "meta";
      const bits = [];
      if (timetable.hourly_quota != null) bits.push(i18n.hourlyQuota + ": " + timetable.hourly_quota);
      if (timetable.monthly_quota != null) bits.push(i18n.monthlyQuota + ": " + timetable.monthly_quota);
      if (timetable.issued_on) bits.push(i18n.issued + ": " + timetable.issued_on);
      if (timetable.source_updated_on) bits.push(i18n.sourceUpdated + ": " + timetable.source_updated_on);
      quotas.textContent = bits.join(" · ");
      const wrap = document.createElement("div");
      wrap.className = "grid-wrap";
      const table = document.createElement("table");
      table.className = "hours";
      const thead = document.createElement("thead");
      const headRow = document.createElement("tr");
      const corner = document.createElement("th");
      corner.textContent = i18n.openingHours;
      headRow.appendChild(corner);
      for (const day of timetable.dates) {
        const th = document.createElement("th");
        const parsed = new Date(day + "T00:00:00");
        th.textContent = parsed.toLocaleDateString(localeTag(), { day: "numeric", weekday: "short" });
        headRow.appendChild(th);
      }
      thead.appendChild(headRow);
      const tbody = document.createElement("tbody");
      for (const row of timetable.rows) {
        const tr = document.createElement("tr");
        const label = document.createElement("td");
        label.textContent = row.start + "–" + row.end;
        tr.appendChild(label);
        row.cells.forEach(function (status) {
          const td = document.createElement("td");
          if (status) td.className = "st-" + status;
          td.textContent = status || "";
          td.title = slotLabels[status] || "";
          tr.appendChild(td);
        });
        tbody.appendChild(tr);
      }
      table.append(thead, tbody);
      wrap.appendChild(table);
      const note = document.createElement("p");
      note.className = "note";
      note.textContent = i18n.timetableNote;
      drawer.append(quotas, wrap, note);
    } else {
      const message = document.createElement("p");
      message.textContent = i18n.noTimetable;
      drawer.appendChild(message);
    }

    const official = safeOfficial(data.official_url);
    if (official) {
      const link = document.createElement("p");
      const anchor = document.createElement("a");
      anchor.className = "official";
      anchor.href = official;
      anchor.target = "_blank";
      anchor.rel = "noopener";
      anchor.textContent = i18n.officialPage;
      link.appendChild(anchor);
      drawer.appendChild(link);
    }
    close.focus();
  }

  async function openDrawer(id, options) {
    options = options || {};
    selectedId = id;
    highlight(id);
    const brief = venues.find(function (item) { return item.id === id; });
    if (brief && brief.lat != null && options.pan !== false) {
      map.setView([brief.lat, brief.lng], Math.max(map.getZoom(), 15));
    }
    drawer.classList.add("is-open");
    drawer.textContent = i18n.running;
    const params = new URLSearchParams();
    if (options.year) params.set("year", String(options.year));
    if (options.month) params.set("month", String(options.month));
    if (options.room) params.set("room", String(options.room));
    const query = params.toString();
    try {
      const response = await fetch(detailUrl(id) + (query ? "?" + query : ""), { headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("detail");
      const data = await response.json();
      if (selectedId !== id) return;
      renderDrawer(data);
    } catch (error) {
      drawer.textContent = i18n.couldNotLoadRoom;
    }
  }

  function closeDrawer() {
    drawer.classList.remove("is-open");
    drawer.replaceChildren();
    selectedId = null;
    for (const card of listEl.querySelectorAll(".card")) card.classList.remove("is-selected");
  }

  async function loadVenues() {
    const response = await fetch(venuesUrl, { headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error("venues");
    const data = await response.json();
    venues = data.venues || [];
    applyFilters();
  }

  function applyStatus(data) {
    const status = data.run && data.run.status;
    const active = status === "queued" || status === "running";
    updateBtn.disabled = active;
    updateBtn.setAttribute("aria-busy", active ? "true" : "false");
    stateEl.textContent = data.message || (statusLabels[status] || "");
    if (data.last_success_at) updatedEl.textContent = i18n.lastUpdated + " " + formatTime(data.last_success_at);
    if (data.run && data.run.log_tail) logEl.textContent = data.run.log_tail;
  }

  function wait(ms) {
    return new Promise(function (resolve) { window.setTimeout(resolve, ms); });
  }

  async function poll() {
    if (polling) return;
    polling = true;
    try {
      while (true) {
        const response = await fetch(statusUrl, { headers: { Accept: "application/json" } });
        const data = await response.json();
        applyStatus(data);
        const status = data.run && data.run.status;
        if (status !== "queued" && status !== "running") {
          if (status === "success") await loadVenues();
          break;
        }
        await wait(2000);
      }
    } finally {
      polling = false;
    }
  }

  listEl.addEventListener("click", function (event) {
    const card = event.target.closest(".card");
    if (!card) return;
    openDrawer(Number(card.dataset.id));
  });
  document.addEventListener("click", function (event) {
    const button = event.target.closest("[data-open]");
    if (!button) return;
    openDrawer(Number(button.dataset.open));
  });
  drawer.addEventListener("click", function (event) {
    if (event.target.id === "drawer-close") closeDrawer();
  });
  document.addEventListener("keydown", function (event) {
    if (event.key === "Escape") closeDrawer();
  });
  for (const element of [searchEl, districtEl, regionEl, equipmentEl, accessibleEl, openNowEl]) {
    element.addEventListener("input", applyFilters);
    element.addEventListener("change", applyFilters);
  }
  function forgetUserLocation() {
    userPoint = null;
    if (userCircle) {
      map.removeLayer(userCircle);
      userCircle = null;
    }
    if (userDot) {
      map.removeLayer(userDot);
      userDot = null;
    }
    locationNote.textContent = "";
  }

  function detectUserLocation() {
    forgetUserLocation();
    map.stopLocate();
    map.locate({
      setView: true,
      maxZoom: 14,
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 12000,
      watch: false,
    });
  }

  nearMeBtn.addEventListener("click", detectUserLocation);
  map.on("locationfound", function (event) {
    locationPending = false;
    skipNextFit = true;
    userPoint = event.latlng;
    if (userCircle) map.removeLayer(userCircle);
    if (userDot) map.removeLayer(userDot);
    userCircle = L.circle(event.latlng, {
      radius: event.accuracy,
      color: "#0e7a5f",
      weight: 1,
      fillColor: "#0e7a5f",
      fillOpacity: 0.12,
    }).addTo(map);
    userDot = L.circleMarker(event.latlng, {
      radius: 6,
      color: "#ffffff",
      weight: 2,
      fillColor: "#0e7a5f",
      fillOpacity: 1,
    }).addTo(map);
    applyFilters();
  });
  map.on("locationerror", function () {
    locationPending = false;
    locationNote.textContent = i18n.locationDenied;
    applyFilters();
  });
  updateBtn.addEventListener("click", async function () {
    updateBtn.disabled = true;
    try {
      const response = await fetch(syncUrl, {
        method: "POST",
        headers: { "X-CSRFToken": csrf, Accept: "application/json" },
      });
      const data = await response.json();
      applyStatus(data);
      if (response.status === 429) {
        updateBtn.disabled = false;
        return;
      }
      if (response.status >= 500) {
        stateEl.textContent = i18n.failed;
        updateBtn.disabled = false;
        return;
      }
      poll();
    } catch (error) {
      stateEl.textContent = i18n.failed;
      updateBtn.disabled = false;
    }
  });
  langForm.addEventListener("submit", function () {
    const next = langForm.querySelector('input[name="next"]');
    const url = new URL(window.location.href);
    if (selectedId) url.searchParams.set("venue", String(selectedId));
    else url.searchParams.delete("venue");
    next.value = url.pathname + url.search;
  });
  document.getElementById("lang").addEventListener("change", function () {
    langForm.requestSubmit();
  });

  window.setTimeout(function () { map.invalidateSize(); }, 250);
  detectUserLocation();
  loadVenues().then(function () {
    const initial = Number(body.dataset.venue);
    if (Number.isInteger(initial) && initial > 0) openDrawer(initial);
  }).catch(function () {
    listEl.textContent = i18n.couldNotLoadRooms;
  });
  fetch(statusUrl, { headers: { Accept: "application/json" } }).then(function (response) {
    return response.json();
  }).then(function (data) {
    applyStatus(data);
    const status = data.run && data.run.status;
    if (status === "queued" || status === "running") poll();
  }).catch(function () {
    stateEl.textContent = "";
  });
})();
