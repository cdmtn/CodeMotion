export function onElementCreate(data) {
    const context = data.extName

    function apply(wrapper) {
        const type = data.type
        const id = data.id

        if(type == "image") {
            const img = document.createElement("img")
            img.id = id
            
            wrapper.appendChild(img)
        }
    }

    if(document.querySelector(`.extension-elements__wrapper[id="${context}"]`)) {
        apply(document.querySelector(`.extension-elements__wrapper[id="${context}"]`))
    }
    else {
        const wrapper = document.createElement("div")
        wrapper.classList.add("extension-elements__wrapper")
        wrapper.id = context

        document.body.prepend(wrapper)

        apply(wrapper)
    }
}