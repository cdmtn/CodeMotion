export async function setUserPcInfo() {
    const info = await window.electron.getUserPcInfo();
    document.querySelectorAll("#username").forEach(e => { e.textContent = info.name; });

    function updateTime() {
        const now = new Date().format("F j, H:i");
        document.querySelectorAll("#current_hours").forEach(el => { el.textContent = now; });
    }
    updateTime();

    const now = new Date();
    const msToNextMinute = (60 - now.getSeconds()) * 1000 - now.getMilliseconds();

    setTimeout(() => {
        updateTime();
        setInterval(updateTime, 60 * 1000);
    }, msToNextMinute);
}