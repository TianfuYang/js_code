$(function() {
    var resultCollector = Quagga.ResultCollector.create({
        capture: true,
        capacity: 20,
        blacklist: [{
            code: "WIWV8ETQZ1", format: "code_93"
        }, {
            code: "EH3C-%GU23RK3", format: "code_93"
        }, {
            code: "O308SIHQOXN5SA/PJ", format: "code_93"
        }, {
            code: "DG7Q$TV8JQ/EN", format: "code_93"
        }, {
            code: "VOFD1DB5A.1F6QU", format: "code_93"
        }, {
            code: "4SO64P4X8 U4YUU1T-", format: "code_93"
        }],
        filter: function(codeResult) {
            // only store results which match this constraint
            // e.g.: codeResult
            return true;
        }
    });
    var App = {
        init: function() {
            var self = this;

            Quagga.init(this.state, function(err) {
                if (err) {
                    return self.handleError(err);
                }
                //Quagga.registerResultCollector(resultCollector);
                App.attachListeners();
                App.checkCapabilities();
                Quagga.start();
            });
        },
        handleError: function(err) {
            console.log(err);
        },
        checkCapabilities: function() {
            var track = Quagga.CameraAccess.getActiveTrack();
            var capabilities = {};
            if (typeof track.getCapabilities === 'function') {
                capabilities = track.getCapabilities();
            }
            this.applySettingsVisibility('zoom', capabilities.zoom);
            this.applySettingsVisibility('torch', capabilities.torch);
        },
        updateOptionsForMediaRange: function(node, range) {
            console.log('updateOptionsForMediaRange', node, range);
            var NUM_STEPS = 6;
            var stepSize = (range.max - range.min) / NUM_STEPS;
            var option;
            var value;
            while (node.firstChild) {
                node.removeChild(node.firstChild);
            }
            for (var i = 0; i <= NUM_STEPS; i++) {
                value = range.min + (stepSize * i);
                option = document.createElement('option');
                option.value = value;
                option.innerHTML = value;
                node.appendChild(option);
            }
        },
        applySettingsVisibility: function(setting, capability) {
            // depending on type of capability
            if (typeof capability === 'boolean') {
                var node = document.querySelector('input[name="settings_' + setting + '"]');
                if (node) {
                    node.parentNode.style.display = capability ? 'block' : 'none';
                }
                return;
            }
            if (window.MediaSettingsRange && capability instanceof window.MediaSettingsRange) {
                var node = document.querySelector('select[name="settings_' + setting + '"]');
                if (node) {
                    this.updateOptionsForMediaRange(node, capability);
                    node.parentNode.style.display = 'block';
                }
                return;
            }
        },
        initCameraSelection: function(){
            var streamLabel = Quagga.CameraAccess.getActiveStreamLabel();

            return Quagga.CameraAccess.enumerateVideoDevices()
            .then(function(devices) {
                function pruneText(text) {
                    // console.log('打印检测到的字符：',text)
                    if (undefined != text){
                        // console.log('打印检测到的字符2：',text)
                        return text.length > 30 ? text.substr(0, 30) : text;
                        }
                    return '123啥也没有'
                }
                var $deviceSelection = document.getElementById("deviceSelection");
                while ($deviceSelection.firstChild) {
                    $deviceSelection.removeChild($deviceSelection.firstChild);
                }
                devices.forEach(function(device) {
                    var $option = document.createElement("option");
                    $option.value = device.deviceId || device.id;
                    $option.appendChild(document.createTextNode(pruneText(device.label || device.deviceId || device.id)));
                    $option.selected = streamLabel === device.label;
                    $deviceSelection.appendChild($option);
                });
            });
        },
        attachListeners: function() {
            const self = this;
            self.initCameraSelection();

            $(".controls").on("click", "button.stop", function(e) {
                e.preventDefault();
                Quagga.stop();
                self._printCollectedResults();
            });

            $(".controls .reader-config-group").on("change", "input, select", function(e) {
                console.log("监听到模式的改变：",e.target)
                e.preventDefault();
                var $target = $(e.target),
                    value = $target.attr("type") === "checkbox" ? $target.prop("checked") : $target.val(),
                    name = $target.attr("name"),
                    state = self._convertNameToState(name);

                console.log("Value of "+ state + " changed to " + value);
                self.setState(state, value);
            });
        },
        _printCollectedResults: function() {
            var results = resultCollector.getResults(),
                $ul = $("#result_strip ul.collector");

            results.forEach(function(result) {
                var $li = $('<li><div class="thumbnail"><div class="imgWrapper"><img /></div><div class="caption"><h4 class="code"></h4></div></div></li>');

                $li.find("img").attr("src", result.frame);
                $li.find("h4.code").html(result.codeResult.code + " (" + result.codeResult.format + ")");
                $ul.prepend($li);
            });
        },
        _accessByPath: function(obj, path, val) {
            var parts = path.split('.'),
                depth = parts.length,
                setter = (typeof val !== "undefined") ? true : false;

            return parts.reduce(function(o, key, i) {
                if (setter && (i + 1) === depth) {
                    if (typeof o[key] === "object" && typeof val === "object") {
                        Object.assign(o[key], val);
                    } else {
                        o[key] = val;
                    }
                }
                return key in o ? o[key] : {};
            }, obj);
        },
        _convertNameToState: function(name) {
            return name.replace("_", ".").split("-").reduce(function(result, value) {
                return result + value.charAt(0).toUpperCase() + value.substring(1);
            });
        },
        detachListeners: function() {
            $(".controls").off("click", "button.stop");
            $(".controls .reader-config-group").off("change", "input, select");
        },
        applySetting: function(setting, value) {
            var track = Quagga.CameraAccess.getActiveTrack();
            if (track && typeof track.getCapabilities === 'function') {
                switch (setting) {
                case 'zoom':
                    return track.applyConstraints({advanced: [{zoom: parseFloat(value)}]});
                case 'torch':
                    return track.applyConstraints({advanced: [{torch: !!value}]});
                }
            }
        },
        setState: function(path, value) {
            var self = this;

            if (typeof self._accessByPath(self.inputMapper, path) === "function") {
                value = self._accessByPath(self.inputMapper, path)(value);
            }

            if (path.startsWith('settings.')) {
                var setting = path.substring(9);
                return self.applySetting(setting, value);
            }
            self._accessByPath(self.state, path, value);

            console.log(JSON.stringify(self.state));
            App.detachListeners();
            Quagga.stop();
            App.init();
        },
        inputMapper: {
            inputStream: {
                constraints: function(value){
                    if (/^(\d+)x(\d+)$/.test(value)) {
                        var values = value.split('x');
                        return {
                            width: {min: parseInt(values[0])},
                            height: {min: parseInt(values[1])}
                        };
                    }
                    return {
                        deviceId: value
                    };
                }
            },
            numOfWorkers: function(value) {
                return parseInt(value);
            },
            decoder: {
                readers: function(value) {

                    if (value === 'ean_extended') {
                        return [{
                            format: "ean_reader",
                            config: {
                                supplements: [
                                    'ean_5_reader', 'ean_2_reader'
                                ]
                            }
                        }];
                    }
                    return [{
                        format: value + "_reader",
                        config: {}
                    }];
                }
            }
        },
        state: {
            inputStream: {
                type : "LiveStream",
                constraints: {
                    width: {min: 640},
                    height: {min: 480},
                    facingMode: "environment",
                    aspectRatio: {min: 1, max: 2}
                }
            },
            locator: {
                patchSize: "medium",
                halfSample: true
            },
            numOfWorkers: 2,
            frequency: 10,
            decoder: {
                readers : [{
                    format: "code_128_reader",
                    config: {}
                }]
            },
            locate: true
        },
        lastResult : null
    };

    App.init();
    var shi_bie_times = 1;
    var detected_result_code = new Array();
    var detected_all_result = {};
    Quagga.onProcessed(function(result) {
        // console.log('本次Processed识别的条码结果为：',result,"当前识别次数：",shi_bie_times)
        shi_bie_times +=1
        var drawingCtx = Quagga.canvas.ctx.overlay,
            drawingCanvas = Quagga.canvas.dom.overlay;

        if (result) {
            if (result.boxes) {
                // 大致探测范围 当前还未标出最终识别区域的范围
                // console.log("探测到可能的区域了")
                drawingCtx.clearRect(0, 0, parseInt(drawingCanvas.getAttribute("width")), parseInt(drawingCanvas.getAttribute("height")));
                result.boxes.filter(function (box) {
                    return box !== result.box;
                }).forEach(function (box) {
                    Quagga.ImageDebug.drawPath(box, {x: 0, y: 1}, drawingCtx, {color: "green", lineWidth: 2});

                });
                if (shi_bie_times > 5){
                    // 本轮探测次数已经大于5次
                    if (result.box) {
                    // 标出最终识别区域的范围
                        console.log("探测到---最终----的区域了,当前轮次探测次数为：",shi_bie_times)


                    }else{
                        // console.log("本轮探测次数已经大于5次，但 没有 探测到最终的区域,当前轮次探测次数为：",shi_bie_times ,'请尝试更换探测模式')
                        var gd2=document.getElementById("select_id");

                        //为防止有时指定id元素不存在导致的异常
                        // if(gd2)
                        // { 
                           // gd2.value='ean'; //更改选定项，值为select选项中原有值（即换一个选择项）
   
                            // App.attachListeners();
                            // App.checkCapabilities();
                            // Quagga.start();
                        // }
                    }
                    shi_bie_times = 1
                }
                

            }

            if (result.box) {
                // 标出最终识别区域的范围
                // console.log("探测到---最终----的区域了2")
                Quagga.ImageDebug.drawPath(result.box, {x: 0, y: 1}, drawingCtx, {color: "blue", lineWidth: 2});
            }

            if (result.codeResult) {
                // console.log('本次Processed识别的条码结果2为：',result.codeResult.code,"当前识别次数：",shi_bie_times)
                // shi_bie_times +=1
            }

            if (result.codeResult && result.codeResult.code) {
                // console.log('本次Processed识别的条码结果3为：',result.codeResult.code,"当前识别次数：",shi_bie_times)
                shi_bie_times +=1
                detected_result_code.push(result.codeResult.code)
                Quagga.ImageDebug.drawPath(result.line, {x: 'x', y: 'y'}, drawingCtx, {color: 'red', lineWidth: 3});
            }
        }
    });
    
    // 控制一下正确率 当同一个码被识别出right_count_level 次才被添加
    var right_count_level = 3
    var current_all_result = {}
    Quagga.onDetected(function(result) {
        var code = result.codeResult.code;

        if (undefined == current_all_result[code]){
            current_all_result[code] = 1   
            console.log(222,undefined == current_all_result[code],code,current_all_result)
            

        }else{
            current_all_result[code] = current_all_result[code]+1

            if (current_all_result[code] == right_count_level && undefined == detected_all_result[code]){
                console.log('当前情况：',code,current_all_result[code])
                var $node = null, canvas = Quagga.canvas.dom.image;
                $node = $('<li><div class="thumbnail"><div class="imgWrapper"><img /></div><div class="caption"><h4 class="code"></h4></div></div></li>');
                $node.find("img").attr("src", canvas.toDataURL());
                $node.find("h4.code").html(code);
                $("#result_strip ul.thumbnails").prepend($node); 
                console.log('添加一个',code,current_all_result[code])
                current_all_result = {};
                detected_all_result[code] = canvas.toDataURL()
                console.log('添加完之后的对象清空了吗？',code,current_all_result)
                console.log('添加完之后的对象detected_all_result',code,detected_all_result)
            }
        }
    });

});
