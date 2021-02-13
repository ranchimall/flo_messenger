const pinLogin = document.createElement('template');
pinLogin.innerHTML =  `

<style>
		
		 *{
            padding:0;
            margin:0;
            -webkit-box-sizing: border-box;
                     box-sizing: border-box;
          }
		
		.pin-container{
			display:flex;
			 gap: 0.5rem;
		}
	
		.input-style{
			width:3.5rem;
			height:4.5rem;
			border:none;
			background-color: #d5d5d5;
			border-radius:8px;
            outline:none;
			font-size:70px;
			text-align: center;
			color:#696969;
		}
		
		input[type='password'].input-pin{
			background-color:#fff;
		}
		
		input[type="password"]:focus {
			border: 3px solid #0000ff;
		}

</style>
<div class="pin-container"></div>

`;

customElements.define('login-pin',
					  
 class extends HTMLElement {
    constructor() {
        super()
        this.attachShadow({
            mode: 'open'
        }).append(pinLogin.content.cloneNode(true))

		this.pin_block = [];
        this.container = this.shadowRoot.querySelector('.pin-container');
    }
	 
	renderBlocks(){
        const frag = document.createDocumentFragment();
		
		 for(let i=0 ; i<4;i++){
			 
            const password = document.createElement('input');
            password.classList.add('input-style');
		    password.setAttribute('type', "password");
            password.setAttribute('maxlength', "1");
			 
            this.pin_block.push(password);
            
			frag.append(password);
		  }
		
        this.container.append(frag);
	}

	 
	connectedCallback() {
         this.renderBlocks();
		 this.pin_block[0].focus();
		 let pin_block = this.pin_block;
		 let count =0;
		 this.pin_block.forEach((input) =>{
		     input.addEventListener('keydown' , function(e){
			       if(e.keyCode >=48 && e.keyCode<= 57){
			            if(count>4){
				           e.preventDefault();
			                       } 
					   else{
						   
				           pin_block[count].classList.add('input-pin');
				           pin_block[count++].focus();
				           }
 
		             }
			        
				    if(e.key === "Backspace"){
			              if(count <= 0){
				             e.preventDefault();
			                            }
			             else{	
				             count--;
				             pin_block[count].classList.remove('input-pin');
				             pin_block[count].focus();
				
				            }
			  
		              }
			      });
	           });
   
	        }

	 
 });