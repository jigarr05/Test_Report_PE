const form = document.getElementById("testReportForm");
const equipmentSelect = document.getElementById("equipment");
const otherDetails = document.getElementById("otherDetails");
const otherEquipmentInput = document.getElementById("otherEquipment");
const quantityInput = document.getElementById("quantity");
const decreaseQuantityButton = document.getElementById("decreaseQuantity");
const increaseQuantityButton = document.getElementById("increaseQuantity");

const equipmentRows = {
  lights: "lights",
  fan: "fan",
  plug5a: "plug5a",
  plug15a: "plug15a",
  ac: "ac",
  geyser: "geyser",
};
const equipmentBatches = new WeakMap();
const reportTable = document.getElementById("reportTable");
const totalQuantityValue = document.getElementById("totalQuantityValue");
const totalWattValue = document.getElementById("totalWattValue");

reportTable.querySelectorAll("tbody tr").forEach((row) => {
  const cell = row.insertCell();
  cell.className = "row-quantity-controls";
  const equipmentName = row.cells[0].textContent.trim();

  [
    { change: -1, label: `Decrease ${equipmentName} quantity`, text: "−" },
    { change: 1, label: `Increase ${equipmentName} quantity`, text: "+" },
  ].forEach(({ change, label, text }) => {
    const button = document.createElement("button");
    button.type = "button";
    button.dataset.quantityChange = String(change);
    button.setAttribute("aria-label", label);
    button.textContent = text;
    button.disabled = change < 0;
    cell.append(button);
  });
});

function updateOtherDetails() {
  const isOther = equipmentSelect.value === "other";
  otherDetails.style.display = isOther ? "block" : "none";
  otherEquipmentInput.required = isOther;
}

function updateQuantityControls() {
  const quantity = Number(quantityInput.value);
  decreaseQuantityButton.disabled = quantity <= Number(quantityInput.min);
}

decreaseQuantityButton.addEventListener("click", () => {
  quantityInput.stepDown();
  updateQuantityControls();
});

increaseQuantityButton.addEventListener("click", () => {
  quantityInput.stepUp();
  updateQuantityControls();
});

quantityInput.addEventListener("input", updateQuantityControls);
updateQuantityControls();

function updateRow(row) {
  const singleNo = row.querySelector('[id$="SingleNo"]');
  const singleWatt = row.querySelector('[id$="SingleWatt"]');
  const totalNo = row.querySelector('[id$="TotalNo"]');
  const totalWatt = row.querySelector('[id$="TotalWatt"]');
  const batches = equipmentBatches.get(row) ?? [];
  const totals = batches.reduce(
    (sum, batch) => {
      const phaseCounts = [
        Math.floor(batch.quantity / 3),
        Math.floor(batch.quantity / 3),
        Math.floor(batch.quantity / 3),
      ];
      const remainder = batch.quantity % 3;

      if (remainder === 1) {
        phaseCounts[2] += 1;
      } else if (remainder === 2) {
        phaseCounts[1] += 1;
        phaseCounts[2] += 1;
      }

      sum.quantity += batch.quantity;
      sum.wattage += batch.quantity * batch.wattage;
      phaseCounts.forEach((count, index) => {
        sum.phaseCounts[index] += count;
        sum.phaseWattages[index] += count * batch.wattage;
      });
      return sum;
    },
    { quantity: 0, wattage: 0, phaseCounts: [0, 0, 0], phaseWattages: [0, 0, 0] },
  );

  singleNo.textContent = totals.quantity ? "1" : "";
  singleWatt.replaceChildren();
  if (batches.length) {
    const wattageInput = document.createElement("input");
    wattageInput.type = "number";
    wattageInput.min = "1";
    wattageInput.step = "1";
    wattageInput.value = String(batches[batches.length - 1].wattage);
    wattageInput.className = "single-unit-wattage";
    wattageInput.setAttribute(
      "aria-label",
      `Wattage per unit for ${row.cells[0].textContent.trim()}`,
    );
    singleWatt.append(wattageInput);
  }
  totalNo.textContent = totals.quantity ? String(totals.quantity) : "";
  totalWatt.textContent = totals.quantity ? String(totals.wattage) : "";

  ["R", "Y", "B"].forEach((phase, index) => {
    const phaseNo = row.querySelector(`[id$="${phase}No"]`);
    const phaseWatt = row.querySelector(`[id$="${phase}Watt"]`);
    phaseNo.textContent = totals.phaseCounts[index] ? String(totals.phaseCounts[index]) : "";
    phaseWatt.textContent = totals.phaseCounts[index] ? String(totals.phaseWattages[index]) : "";
  });

  row.querySelector('[data-quantity-change="-1"]').disabled = totals.quantity === 0;
  updateReportTotals();
}

function updateReportTotals() {
  const totals = Array.from(reportTable.tBodies[0].rows)
    .filter((row) => !row.hidden)
    .reduce(
      (sum, row) => {
        sum.quantity += Number(row.querySelector('[id$="TotalNo"]').textContent) || 0;
        sum.wattage += Number(row.querySelector('[id$="TotalWatt"]').textContent) || 0;
        return sum;
      },
      { quantity: 0, wattage: 0 },
    );

  totalQuantityValue.textContent = String(totals.quantity);
  totalWattValue.textContent = String(totals.wattage);
}

function addToRow(row, quantity, wattage) {
  const batches = equipmentBatches.get(row) ?? [];
  batches.push({ quantity, wattage });
  equipmentBatches.set(row, batches);
  updateRow(row);
}

reportTable.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-quantity-change]");
  if (!button) {
    return;
  }

  const row = button.closest("tr");
  const batches = equipmentBatches.get(row) ?? [];
  const latestBatch = batches[batches.length - 1];
  if (!latestBatch) {
    return;
  }

  latestBatch.quantity += Number(button.dataset.quantityChange);
  if (latestBatch.quantity === 0) {
    batches.pop();
  }
  equipmentBatches.set(row, batches);
  updateRow(row);
});

reportTable.addEventListener("change", (event) => {
  const input = event.target.closest("input.single-unit-wattage");
  if (!input) {
    return;
  }

  const row = input.closest("tr");
  const batches = equipmentBatches.get(row) ?? [];
  const latestBatch = batches[batches.length - 1];
  if (!latestBatch) {
    return;
  }

  const wattage = input.valueAsNumber;
  if (!input.validity.valid || !Number.isFinite(wattage) || wattage < 1) {
    window.alert("Enter a wattage of at least 1 W.");
    updateRow(row);
    return;
  }

  latestBatch.wattage = wattage;
  equipmentBatches.set(row, batches);
  updateRow(row);
});

function getOtherRow(name) {
  const normalizedName = name.toLocaleLowerCase();
  const rows = document.querySelectorAll('tr[id^="other-"]');
  const existingRow = Array.from(rows).find(
    (row) => row.dataset.equipmentName === normalizedName,
  );

  if (existingRow) {
    return existingRow;
  }

  return Array.from(rows).find((row) => !row.dataset.equipmentName);
}

equipmentSelect.addEventListener("change", updateOtherDetails);
updateOtherDetails();

form.addEventListener("submit", (event) => {
  event.preventDefault();

  const quantity = Number(document.getElementById("quantity").value);
  const wattage = Number(document.getElementById("watt").value);
  let row;

  if (equipmentSelect.value === "other") {
    const name = otherEquipmentInput.value.trim();
    row = getOtherRow(name);

    if (!row) {
      window.alert("All four Other rows are in use.");
      return;
    }

    row.dataset.equipmentName = name.toLocaleLowerCase();
    row.cells[0].textContent = name;
    row.querySelector('[data-quantity-change="-1"]').setAttribute(
      "aria-label",
      `Decrease ${name} quantity`,
    );
    row.querySelector('[data-quantity-change="1"]').setAttribute(
      "aria-label",
      `Increase ${name} quantity`,
    );
    row.hidden = false;
  } else {
    row = document.getElementById(equipmentRows[equipmentSelect.value]);
  }

  if (!row) {
    window.alert("Select a valid equipment type.");
    return;
  }

  addToRow(row, quantity, wattage);
  otherEquipmentInput.value = "";
});