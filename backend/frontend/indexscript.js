async function trackShipment() {
  const input = document.getElementById("trackingNumber");
  const resultBox = document.getElementById("trackingResult");
  const trackingNumber = input.value.trim().toUpperCase();

  resultBox.innerHTML = "";

  if (!trackingNumber) {
    resultBox.innerHTML = "<p style='color:red'>Please enter a tracking number.</p>";
    return;
  }

  try {
    const res = await fetch(`/api/shipments/${trackingNumber}`); // <-- relative URL

    if (!res.ok) {
      resultBox.innerHTML = "<p style='color:red'>Tracking number not found.</p>";
      return;
    }

    window.location.href = `track.html?tn=${trackingNumber}`;

  } catch (err) {
    resultBox.innerHTML = "<p style='color:red'>Server error. Try again later.</p>";
  }
}
