document.addEventListener("DOMContentLoaded", function () {

  const API = "http://localhost:3000/api/shipments";

  // --- Form inputs ---
  const trackingInput = document.getElementById("tracking");
  const sender = document.getElementById("sender");
  const recipient = document.getElementById("recipient"); // matches HTML
  const origin = document.getElementById("origin");
  const destination = document.getElementById("destination");
  const weight = document.getElementById("weight");
  const status = document.getElementById("status");
  const shipmentTable = document.getElementById("shipmentTable");

  // --- Generate tracking number ---
  function generateTrackingNumber() {
    return "EC-" + Math.random().toString(36).substring(2, 10).toUpperCase();
  }

  // --- Set initial tracking number ---
  trackingInput.value = generateTrackingNumber();

  let routePoints = [];
  let shipments = [];

  // ================= MAP =================
  const adminMap = L.map("adminMap").setView([6.5244, 3.3792], 4);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(adminMap);

  adminMap.on("click", function (e) {
    const label = prompt("Label (Origin, Transit, Destination)");
    if (!label) return;

    const marker = L.marker(e.latlng, { draggable: true })
      .addTo(adminMap)
      .bindPopup(label)
      .openPopup();

    routePoints.push({ lat: e.latlng.lat, lng: e.latlng.lng, label, marker });

    marker.on("dragend", () => {
      const p = routePoints.find(r => r.marker === marker);
      if (p) {
        p.lat = marker.getLatLng().lat;
        p.lng = marker.getLatLng().lng;
      }
    });
  });

  // ================= LOAD SHIPMENTS =================
  function loadShipments() {
    fetch(API)
      .then(res => res.json())
      .then(data => {
        shipments = data;
        renderTable();
      })
      .catch(err => console.error("Error loading shipments:", err));
  }

  // ================= SAVE / UPDATE =================
  window.saveShipment = async function () {
    if (!recipient.value) {
      alert("Please enter a recipient name");
      return;
    }

    const shipment = {
      trackingNumber: trackingInput.value,
      sender: sender.value,
      recipient: recipient.value, // backend field
      origin: origin.value,
      destination: destination.value,
      weight: weight.value,
      status: status.value,
      progress: [status.value],
      history: [{
        date: new Date().toLocaleString(),
        location: origin.value,
        status: status.value
      }],
      route: routePoints.map(p => ({ lat: p.lat, lng: p.lng, label: p.label }))
    };

    const exists = shipments.find(s => s.trackingNumber === shipment.trackingNumber);

    try {
      const res = await fetch(exists ? `${API}/${shipment.trackingNumber}` : API, {
        method: exists ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(shipment)
      });

      if (!res.ok) throw new Error("Failed to save shipment");

      alert("Shipment saved successfully!");
      resetForm();
      loadShipments();
    } catch (err) {
      console.error(err);
      alert("Error saving shipment. Check console.");
    }
  };

  // ================= DELETE =================
  window.removeShipment = async function (tn) {
    try {
      await fetch(`${API}/${tn}`, { method: "DELETE" });
      loadShipments();
    } catch (err) {
      console.error(err);
      alert("Error deleting shipment");
    }
  };

  // ================= EDIT =================
  window.editShipment = function (tn) {
    const s = shipments.find(x => x.trackingNumber === tn);
    if (!s) return;

    trackingInput.value = s.trackingNumber;
    sender.value = s.sender;
    recipient.value = s.recipient; // matches backend
    origin.value = s.origin;
    destination.value = s.destination;
    weight.value = s.weight;
    status.value = s.status;

    routePoints = [];
    adminMap.eachLayer(l => l instanceof L.Marker && adminMap.removeLayer(l));

    s.route?.forEach(p => {
      const m = L.marker([p.lat, p.lng], { draggable: true })
        .addTo(adminMap)
        .bindPopup(p.label);
      routePoints.push({ ...p, marker: m });
    });

    if (s.route?.length) adminMap.fitBounds(s.route.map(r => [r.lat, r.lng]));
  };

  // ================= TABLE =================
  function renderTable() {
    shipmentTable.innerHTML = "";
    shipments.forEach(s => {
      shipmentTable.innerHTML += `
        <tr>
          <td>${s.trackingNumber}</td>
          <td>${s.recipient || "N/A"}</td> 
          <td>${s.status}</td>
          <td>
            <button onclick="editShipment('${s.trackingNumber}')">Edit</button>
            <button onclick="removeShipment('${s.trackingNumber}')">Delete</button>
          </td>
        </tr>`;
    });
  }

  // ================= RESET =================
  function resetForm() {
    trackingInput.value = generateTrackingNumber(); // new tracking number
    ["sender","recipient","origin","destination","weight"].forEach(id => document.getElementById(id).value = "");
    routePoints = [];
    adminMap.eachLayer(l => l instanceof L.Marker && adminMap.removeLayer(l));
  }

  loadShipments();
});
