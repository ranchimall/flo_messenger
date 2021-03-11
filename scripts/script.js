/* settings component */
const settingsMenu = document.createElement('template');
settingsMenu.innerHTML = `
 <style>

     *{
            padding: 0;
            margin: 0;
            -webkit-box-sizing: border-box;
                     box-sizing: border-box;
       }

	.settingsContainer{
			display: grid;
			grid-template-columns: auto;
			grid-template-rows: 15rem 5rem;
			grid-row-gap: 5rem;
			font-family: Roboto, 'Helvetica Neue', Arial, sans-serif;
	
	   }
     .menuContainer{
			margin-left: -6rem;
            visibility: hidden;
      }

     .settings{
			padding: 0.25rem;
			border-radius: 0.5rem;
			cursor: pointer;
		
		}

	.svgClicked{
			transform: rotate(-25deg);

		}

	.menu {
			background: rgba(0,0,0,0.8);
			color: #fff;
			margin-bottom: 2rem;
			cursor: pointer;
			position: absolute;
	}

    .submenu{
			background: rgba(0,0,0,0.8);
			color: #fff;
			cursor: pointer;
			position: absolute;
			visibility: hidden;
	        overflow-y: scroll;
			max-height: 18rem;
	}



	::slotted(div) , .submenu div {
			padding: 1.15rem;
			width: 14rem;
			font-size: 1.25rem;
	}

    .submenu div{
			width: 16rem;
	
	}

	::slotted(div:hover) , .submenu div:hover{
			background: rgba(0,0,0,0.9);
	}

</style>
<div class="settingsContainer">
<div class="menuContainer">
	<div class="menu">
		<slot name="menu-options" class="menuSlot"></slot>
	</div>
</div>
	<div class="settings">
			<svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="40" height="40" viewBox="0 0 512 512" class="settingsIcon">
			<path d="M491.755 232.653c0-5.95-4.935-10.844-10.865-10.844h-19.876c-6 0-12.318-4.649-13.978-10.383l-27.065-63.191c-2.877-5.161-1.935-12.871 2.284-17.111l13.456-13.435c4.219-4.219 4.219-11.141 0-15.35l-32.379-32.389c-4.199-4.249-11.1-4.249-15.462 0l-14.541 14.633c-4.26 4.24-12.063 5.406-17.316 2.632l-54.978-21.954c-5.745-1.628-10.455-7.885-10.455-13.834v-20.378c0-5.97-4.885-10.823-10.803-10.823h-45.895c-5.939 0-10.823 4.854-10.823 10.823v20.378c0 5.95-4.71 12.247-10.363 14.019l-63.764 27.279c-5.11 3.010-12.728 2.007-16.988-2.212l-14.295-14.295c-4.198-4.188-11.090-4.188-15.329 0l-32.409 32.43c-4.281 4.229-4.281 11.151 0 15.36l15.544 15.626c4.29 4.198 5.458 11.919 2.704 17.244l-21.657 54.477c-1.597 5.796-7.844 10.455-13.824 10.455h-21.648c-5.919 0-10.793 4.894-10.793 10.844v45.855c0 5.98 4.874 10.885 10.793 10.885h21.637c5.98 0 12.237 4.618 13.998 10.363l26.583 62.7c3.062 5.161 2.017 12.82-2.109 17.060l-14.919 14.817c-4.229 4.24-4.229 11.079 0 15.36l32.43 32.399c4.249 4.199 11.162 4.199 15.299 0l15.933-15.862c4.25-4.219 11.879-5.376 17.203-2.519l55.624 22.18c5.653 1.639 10.363 7.885 10.363 13.824v21.218c0 5.959 4.885 10.844 10.823 10.844h45.895c5.918 0 10.803-4.885 10.803-10.844v-21.217c0-5.939 4.659-12.175 10.455-13.937l62.178-26.378c5.161-2.898 12.738-1.884 17.039 2.304l14.019 14.080c4.219 4.199 11.1 4.199 15.36 0l32.42-32.44c4.24-4.199 4.24-11.12 0-15.339l-14.981-14.899c-4.116-4.24-5.284-11.961-2.498-17.244l22.538-56.064c1.577-5.776 7.895-10.404 13.896-10.445h19.876c5.918 0 10.865-4.905 10.865-10.844v-45.855zM256.031 333.097c-42.649 0-77.097-34.539-77.097-77.107 0-42.578 34.447-77.056 77.097-77.056 42.526 0 77.087 34.478 77.087 77.056 0 42.567-34.56 77.107-77.087 77.107z" fill="#000000" />

			</svg>	
	</div>
</div>

`;

customElements.define('settings-menu', class extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({
            mode: 'open'
        }).append(settingsMenu.content.cloneNode(true))
		
		this.settingsContainer = this.shadowRoot.querySelector('.settingsContainer');
		this.settingsIcon = this.shadowRoot.querySelector('.settingsIcon'); //svg icon
		this.menu = this.shadowRoot.querySelector('.menu'); // for the main menu
		this.menuContainer = this.shadowRoot.querySelector('.menuContainer');
		this.menuSlot = this.shadowRoot.querySelector('.menuSlot');
		this.closeMenu; // for close icons
		this.count = 0; // a counter 
		this.menuIndex;
    }
	
	

    connectedCallback() {

		   // to rotate the svg icon and display the main menu
			this.settingsIcon.addEventListener('click', e => {
	
			if(this.menuIndex){
				this.shadowRoot.querySelector('.submenu'+(this.menuIndex)).style.visibility = "hidden";
			}
			
			
			 if(this.count%2==0){
				 
				this.settingsIcon.classList.add('svgClicked');
			    this.menu.style.visibility = "visible";
				
			 }else{
				 
				 this.settingsIcon.classList.remove('svgClicked');
				 this.menu.style.visibility = "hidden"; 
				 /* I know instead of this I should have added and removed a class but it was not working */
				 
			 }
			
			 this.count++;
             
            });

		// creating slots for sub menu
			const frag = document.createDocumentFragment();
		
			this.menuSlot.assignedElements().forEach( (menuOption , index) =>{
			
			let submenu = document.createElement('div');
			let submenuSlot = document.createElement('slot');
			let submenuTitle = document.createElement('div');
			
		// adding a heading and a close icon to a sub menu
			submenuTitle.innerHTML = "<span class='closeMenu' index=" + (index+1) + ">&#10094;</span> " + menuOption.innerHTML;
				
			menuOption.setAttribute("index", (index+1));
			submenuSlot.setAttribute('name', 'menu' + (index+1));
			submenu.classList.add('submenu');
			submenu.classList.add('submenu' + (index+1));
			
			submenu.append(submenuTitle);
			submenu.append(submenuSlot);
			frag.append(submenu);
			
			});
		
		
			this.menuContainer.append(frag);
		    this.closeMenu = this.shadowRoot.querySelectorAll('.closeMenu'); // get a list of closeIcons
		
		// adding click event to main menu to open respective sub menu
		
			this.menu.addEventListener( 'click', e=> {
			
			let menuOption = e.target.closest('div');
				
		    this.menuIndex = menuOption.getAttribute('index');
			
			let submenu = this.shadowRoot.querySelector('.submenu'+(this.menuIndex));
			
			submenu.style.visibility="visible";
			this.menu.style.visibility = "hidden";
			
			});
		
		// adding click event to close Icons and adding code to hide the respective sub menu
		
			this.closeMenu.forEach((closeButton) =>{
				closeButton.addEventListener('click', e=>{
					let submenuIndex = closeButton.getAttribute('index');
					
					this.shadowRoot.querySelector('.submenu'+(submenuIndex)).style.visibility = "hidden";
					
					this.menu.style.visibility = "visible";
					
				});
			});
		
		
	 }

});