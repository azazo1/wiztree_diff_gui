const { invoke } = window["__TAURI__"].core;
window.addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll('.drop-zone').forEach(zone => {
        zone.addEventListener('dragover', e => {
            e.preventDefault();
            zone.classList.add('dragover');
        });
        zone.addEventListener('dragleave', () => {
            zone.classList.remove('dragover');
        });
        zone.addEventListener('drop', e => {
            e.preventDefault();
            zone.classList.remove('dragover');
            // const files = e.dataTransfer.files;
            // if (files.length > 0) {
            //   const input = zone.querySelector('input[type="file"]');
            //   input.files = files;
            // }
            console.log(e);
        });
    });
});
