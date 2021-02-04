
function getHexCode(colorName){
    switch(colorName){
        case "Red":
            return "#ff0000";

        case "Blue":
            return "#0000ff";

        case "Purple":
            return "#5b00d3";

        case "Mustard":
            return "#ffdb58";

        case "Green":
            return "#00ff00";

        case "Pink":
            return "#ffc0cb";

        case "Cyan":
            return "#00ffff";

        case "Salmon":
            return "#FFA07A";
    }
}

function saveColor(colorName){

    if(colorName){
        localStorage.setItem("color", colorName);
    }

}

let selected = false;
let previousColor;
function selectedColor(colorName){
    let colorID = "theme" + colorName;
    let colorCard = getRef(colorID);
    let previousColorID;
    let previousColorCard;

    if(selected){
        previousColorID = "theme" + previousColor;
        previousColorCard = getRef(previousColorID);
        previousColorCard.style.border = "none";
    }

    if(localStorage.getItem('theme') =='dark'){
         
        colorCard.style.border = "4px solid #fff";
        
    }else{
        
        colorCard.style.border = "4px solid #000";
    }

    selected = true;
    previousColor = colorName;
    
    
    

}

function setTheme(colorName){

    colorHex = getHexCode(colorName);

    document.body.style.setProperty('--accent-color', colorHex);

    saveColor(colorName);

    selectedColor(colorName);
    
}