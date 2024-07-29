document.addEventListener("DOMContentLoaded", () => {
  const container = document.getElementById("checkbox-container");
  const socket = io();

  socket.on("connect", () => {
    console.log("Connected to the server");
    socket.emit("enviar", { usuario: "pepe" });
  });

  for (let i = 1; i <= 100; i++) {
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = `checkbox-${i}`;
    checkbox.name = `checkbox-${i}`;

    const label = document.createElement("label");
    label.htmlFor = `checkbox-${i}`;
    label.textContent = `Checkbox ${i}`;

    container.appendChild(checkbox);

    checkbox.addEventListener("change", () => {
      console.log(`Checkbox ${checkbox.id} changed to ${checkbox.checked}`);
      socket.emit("checkbox changed", {
        id: checkbox.id,
        checked: checkbox.checked,
      });
    });
  }

  socket.on("checkbox changed", (data) => {
    const checkbox = document.getElementById(data.id);
    if (checkbox) {
      checkbox.checked = data.checked;
    }
  });
});
