var items = [];
var items_changed = [];
var publish = false;
var publishReplace = false;
var type_ids = [];
var type_texts = [];
var project = "";
var mapi = "";
var processed = 0;
var source = "";
var target = "";
var toUpdate = 0;
var publishSteps = [];
var archivedSteps = [];

$(document).ready(function()
{		
	$("#submit").click(function() {
		items = [];
		items_changed = [];
		project = $("#project").val();
		mapi = $("#mapi").val();
		source = $("#source").val();
		target = $("#target").val();
		type_ids = [];
		type_texts = [];
		publish = $("#publish").is(':checked');
		publishReplace = $("#publishreplace").is(':checked');
		$("#tables").html("");
		$("#msg").html("");
		processed = 0;
		toUpdate = 0;
		publishSteps = [];
		archivedSteps = [];
		$("#output").html("");
		
		if (source && target) {
			$('.overlay').show();
			loadWF();
		}
		else {
			$("#msg").html("Replace what and Replace with cannot be empty");
		}
	});
});

function loadWF() {
	var url = 'https://manage.kontent.ai/v2/projects/'+project+'/workflows';
	$.ajax({
		url: url,
		dataType: 'text',		
		beforeSend: function(xhr, settings) { 
			if (mapi) {
				xhr.setRequestHeader('Authorization','Bearer '+mapi);
			}
		},
		success: function (data, textStatus, request) {
			data = JSON.parse(data);
			if (data.length > 0) {	
				for (var x = 0; x < data.length; x++) {
					publishSteps.push(data[x].published_step.id);
					archivedSteps.push(data[x].archived_step.id);
				}
				loadTypes("");
			}
			else {
				console.log("no data found");
				$("#msg").html("No data found. Please make sure your project has some workflow defined");
				$('.overlay').hide();
			}
		},
		error:function(jqXHR, textStatus, errorThrown){
			 $("#msg").html("No data found. Please make sure you have correct project id and MAPI token.");
			 $('.overlay').hide();
		} 
	});	
}

function loadTypes(xc) {
	var url = 'https://manage.kontent.ai/v2/projects/'+project+'/types';
	$.ajax({
		url: url,
		dataType: 'text',		
		beforeSend: function(xhr, settings) { 
			if (xc) {
				xhr.setRequestHeader('X-Continuation',xc);
			}
			if (mapi) {
				xhr.setRequestHeader('Authorization','Bearer '+mapi);
			}
		},
		success: function (data, textStatus, request) {
			data = JSON.parse(data);
			if (data.types.length > 0) {				
				var xc = request.getResponseHeader('X-Continuation');
				for (var x = 0; x < data.types.length; x++) {
					processed++;
					type_ids.push(data.types[x].id);
					for (var y = 0; y < data.types[x].elements.length; y++) {
						if (data.types[x].elements[y].type == "text" || data.types[x].elements[y].type == "rich_text") {
							type_texts.push(data.types[x].elements[y].id);
						}						
					}
				}
				if (xc) {
					loadTypes(xc);
				}
				else {
					loadItems(processed,"");
				}
			}
			else {
				console.log("no data found");
				$("#msg").html("No data found. Please make sure your project has some content types defined");
				$('.overlay').hide();
			}
		},
		error:function(jqXHR, textStatus, errorThrown){
			 $("#msg").html("No data found. Please make sure you have correct project id and MAPI token.");
			 $('.overlay').hide();
		} 
	});	
}

function loadItems(type,xc) {
	var url = 'https://manage.kontent.ai/v2/projects/'+project+'/types/'+type_ids[(type-1)]+'/variants';
	$.ajax({
		url: url,
		dataType: 'text',		
		beforeSend: function(xhr, settings) { 
			if (xc) {
				xhr.setRequestHeader('X-Continuation',xc);
			}
			if (mapi) {
				xhr.setRequestHeader('Authorization','Bearer '+mapi);
			}
		},
		success: function (data, textStatus, request) {
			data = JSON.parse(data);
			if (data.variants.length > 0) {
				processItems(data.variants);
				var xc = request.getResponseHeader('X-Continuation');
				if (xc) {
					loadItems(type,xc);
				}
				else {
					processed--;
					if (processed==0) {
						$('.overlay').hide();
						replaceText();
					}
					else {
						loadItems(processed,"")
					}
				}
			}
			else {
				processed--;
				if (processed==0) {
					$('.overlay').hide();
					replaceText();
				}
				else {
					loadItems(processed,"")
				}
			}
		},
		error:function(jqXHR, textStatus, errorThrown){
			 $("#msg").html("No data found. Please make sure you have correct project id and MAPI token.");
			 $('.overlay').hide();
		} 
	});	
}

function processItems(data) {
	for (var x = 0; x < data.length; x++) {
		for (var y = 0; y < data[x].elements.length; y++) {
			if (type_texts.includes(data[x].elements[y].element.id)) {			
				items.push([data[x].item.id, data[x].language.id, data[x].workflow_step.id, data[x].elements[y].value, data[x].elements[y].element.id]);
			}
		}
	}
}

function replaceText() {
	console.log(items);
	for (var x = 0; x < items.length; x++) {
		if (items[x][3].indexOf(source) >= 0) {
			items[x][3] = items[x][3].replace(new RegExp(source, "g"), target);
			items_changed.push(items[x]);
		}
	}
	console.log(items_changed);
	toUpdate = items_changed.length;
	updateItems();
}

function updateItems() {
	toUpdate--;
	if (toUpdate >= 0) {
		if (publishSteps.includes(items_changed[toUpdate][2])) {
			if (publishReplace) {
				createNewVersion();
			}
			else {
				updateItems();
			}
		}
		else if (archivedSteps.includes(items_changed[toUpdate][2])) {
			updateItems();
		}
		else {			
			var data =  {
						  "elements":[
							{
							  "element":{
								"id":items_changed[toUpdate][4]
							  },
							  "value":items_changed[toUpdate][3]
							}
						  ]
						}
				
			var url = 'https://manage.kontent.ai/v2/projects/'+project+'/items/'+items_changed[toUpdate][0]+'/variants/'+items_changed[toUpdate][1];
			$.ajax({
				url: url,
				type: "PUT",
				data: JSON.stringify(data),
				contentType: "application/json",		
				beforeSend: function(xhr, settings) { 
					if (mapi) {
						xhr.setRequestHeader('Authorization','Bearer '+mapi);
					}
				},
				success: function (data, textStatus, request) {
					showMsg("Item "+returnLink(items_changed[toUpdate][0], items_changed[toUpdate][1])+" updated");
					if (items_changed[toUpdate][2]=="toBePublished" && publish) {
						setTimeout(publishVersion,200);
					}
					else {
						setTimeout(updateItems,200);
					}
				},
				error:function(jqXHR, textStatus, errorThrown){
					 $("#msg").html("Problem with updating an item");
					 console.log(errorThrown);
				} 
			});
		}
	}
	else {
		$("#msg").html("DONE");
	}
}

function createNewVersion() {				
	var url = 'https://manage.kontent.ai/v2/projects/'+project+'/items/'+items_changed[toUpdate][0]+'/variants/'+items_changed[toUpdate][1]+'/new-version';
	$.ajax({
		url: url,
		type: "PUT",
		contentType: "application/json",		
		beforeSend: function(xhr, settings) { 
			if (mapi) {
				xhr.setRequestHeader('Authorization','Bearer '+mapi);
			}
		},
		success: function (data, textStatus, request) {
			showMsg("Item "+returnLink(items_changed[toUpdate][0], items_changed[toUpdate][1])+" new version created");
			items_changed[toUpdate][2] = "toBePublished";	
			toUpdate++;
			setTimeout(updateItems,200);
		},
		error:function(jqXHR, textStatus, errorThrown){
			 $("#msg").html("Problem with creating a new version of an item");
			 console.log(errorThrown);
		} 
	});
}

function publishVersion() {				
	var url = 'https://manage.kontent.ai/v2/projects/'+project+'/items/'+items_changed[toUpdate][0]+'/variants/'+items_changed[toUpdate][1]+'/publish';
	$.ajax({
		url: url,
		type: "PUT",
		contentType: "application/json",		
		beforeSend: function(xhr, settings) { 
			if (mapi) {
				xhr.setRequestHeader('Authorization','Bearer '+mapi);
			}
		},
		success: function (data, textStatus, request) {
			showMsg("Item "+returnLink(items_changed[toUpdate][0], items_changed[toUpdate][1])+" published");
			setTimeout(updateItems,200);
		},
		error:function(jqXHR, textStatus, errorThrown){
			 $("#msg").html("Problem with publishing an item");
			 console.log(errorThrown);
		} 
	});
}

function returnLink(id, lang) {
	return "<a href='https://app.kontent.ai/"+project+"/content-inventory/"+lang+"/content/"+id+"' target='_blank'>"+id+"</a>";
}

function showMsg(msg) {
	$("#output").append("<div class='output'>"+msg+"</div>");
}

