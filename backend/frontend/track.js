// Get tracking number from URL
const params = new URLSearchParams(window.location.search);
const tn = params.get("tn")?.toUpperCase(); // convert to uppercase

console.log("Tracking number from URL:", tn);

if (!tn) {
  document.body.innerHTML = "<h2>No tracking number provided</h2>";
  throw new Error("No tracking number");
}

// Fetch shipment from backend (relative URL)
fetch(`/api/shipments/${tn}`)
  .then(res => {
    if (!res.ok) throw new Error("Shipment not found");
    return res.json();
  })
  .then(shipment => {
    console.log("Fetched shipment:", shipment);

    const tnElem = document.getElementById("tn");
    const senderElem = document.getElementById("sender");
    const receiverElem = document.getElementById("receiver");
    const originElem = document.getElementById("origin");
    const destinationElem = document.getElementById("destination");
    const weightElem = document.getElementById("weight");
    const statusElem = document.getElementById("status");
    const progressElem = document.getElementById("progress");
    const historyElem = document.getElementById("history");

    // Display shipment info
    tnElem.textContent = shipment.trackingNumber || "N/A";
    senderElem.textContent = shipment.sender || "N/A";
    receiverElem.textContent = shipment.recipient || "N/A";
    originElem.textContent = shipment.origin || "N/A";
    destinationElem.textContent = shipment.destination || "N/A";
    weightElem.textContent = shipment.weight || "N/A";
    statusElem.textContent = shipment.status || "N/A";

    // Progress
    progressElem.innerHTML = "";
    if (shipment.progress?.length) {
      shipment.progress.forEach(p => {
        const li = document.createElement("li");
        li.textContent = p;
        progressElem.appendChild(li);
      });
    } else {
      progressElem.innerHTML = "<li>No progress recorded</li>";
    }

    // History
    historyElem.innerHTML = "";
    if (shipment.history?.length) {
      shipment.history.forEach(h => {
        const tr = document.createElement("tr");
        tr.innerHTML = `<td>${h.date || "N/A"}</td><td>${h.location || "N/A"}</td><td>${h.status || "N/A"}</td>`;
        historyElem.appendChild(tr);
      });
    } else {
      historyElem.innerHTML = "<tr><td colspan='3'>No history recorded</td></tr>";
    }

    // Map
    const map = L.map("map").setView([6.5244, 3.3792], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

    const coords = shipment.route?.map(r => [r.lat, r.lng]) || [];
    shipment.route?.forEach(r => {
      L.marker([r.lat, r.lng]).addTo(map).bindPopup(r.label || "");
    });
    if (coords.length) map.fitBounds(coords);

  })
  .catch(err => {
    document.body.innerHTML = "<h2>Shipment not found</h2>";
    console.error(err);
  });
