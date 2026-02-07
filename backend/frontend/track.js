// Get tracking number from URL
const params = new URLSearchParams(window.location.search);
const tn = params.get("tn")?.trim().toUpperCase(); // <-- trim + uppercase

if (!tn) {
  document.body.innerHTML = "<h2>No tracking number provided</h2>";
  throw new Error("No tracking number in URL");
}

// Fetch shipment from backend
fetch(`/api/shipments/${tn}`)
  .then(res => {
    if (!res.ok) throw new Error("Shipment not found");
    return res.json();
  })
  .then(shipment => {
    const tnElem = document.getElementById("tn");
    const senderElem = document.getElementById("sender");
    const receiverElem = document.getElementById("receiver");
    const originElem = document.getElementById("origin");
    const destinationElem = document.getElementById("destination");
    const weightElem = document.getElementById("weight");
    const statusElem = document.getElementById("status");
    const lastUpdateElem = document.getElementById("lastUpdate");

    // Fill shipment info
    tnElem.textContent = shipment.trackingNumber || "N/A";
    senderElem.textContent = shipment.sender || "N/A";
    receiverElem.textContent = shipment.recipient || "N/A";
    originElem.textContent = shipment.origin || "N/A";
    destinationElem.textContent = shipment.destination || "N/A";
    weightElem.textContent = shipment.weight || "N/A";
    statusElem.textContent = shipment.status || "N/A";
    lastUpdateElem.textContent = shipment.lastUpdate || "N/A";

    // Map
    const map = L.map("map").setView([6.5244, 3.3792], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    shipment.route?.forEach(r => {
      L.marker([r.lat, r.lng]).addTo(map).bindPopup(r.label || "");
    });
    const coords = shipment.route?.map(r => [r.lat, r.lng]) || [];
    if (coords.length) map.fitBounds(coords);

  })
  .catch(err => {
    document.body.innerHTML = "<h2>Shipment not found</h2>";
    console.error(err);
  });