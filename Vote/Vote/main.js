const $ = selector => {
  return document.querySelector(selector);
};

slide = element => {
  /* Next slide */
  
  if (element.classList.contains('next')) {
    if ($(".hide")) {
      $(".hide").remove(); 
    }

    /* Step */
    
    if ($(".prev")) {
      $(".prev").classList.add("hide");
      $(".prev").classList.remove("prev");
    }
    
    $(".act").classList.add("prev");
    $(".act").classList.remove("act");

    $(".next").classList.add("act");
    $(".next").classList.remove("next");
    
    /* New Next */
    
    $(".new-next").classList.remove("new-next");
    
    let addedEl = document.createElement('li');
      
    $(".list").appendChild(addedEl);
    addedEl.classList.add("next","new-next");
  
  /* Previous slide */
    
  } else if (element.classList.contains('prev')) {
    $(".new-next").remove();
    
    /* Step */
    
    $(".next").classList.add("new-next");
    
    $(".act").classList.add("next");
    $(".act").classList.remove("act");
    
    $(".prev").classList.add("act");
    $(".prev").classList.remove("prev");
    
    /* New Prev */
    
    $(".hide").classList.add("prev");
    $(".hide").classList.remove("hide");
    
    let addedEl = document.createElement('li');

    $(".list").insertBefore(addedEl, $(".list").firstChild);
    addedEl.classList.add("hide");
  }
}

let slider = $(".list");

slider.onclick = event => {
  slide(event.target);
}