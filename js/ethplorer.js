/*!
 * Copyright 2016 Everex https://everex.io
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

Ethplorer = {
    debug: false,
    debugId: "",
    data: {},
    pageSize: 10,
    service: /*"https://ethplorer.io/service/service.php",*/ "/service/service.php",
    filter: '',
    ethPrice: {rate: 0, diff: 0},
    searchCache: {},
    saveData: function(){},
    Config: {testnet: false},
    Extensions: {},
    handlers: {},
    init: function(){
        if('undefined' !== typeof(ethplorerConfig)){
            Ethplorer.Config = ethplorerConfig;
        }
        Ethplorer.isProd = ('ethplorer.io' === document.location.host);
        Ethplorer.showHistoricalPrice = true; // sessionStorage.getItem("enableHistoricalPrice") === 'true';
        BigNumber.config({ ERRORS: false });
        Ethplorer.Nav.init();
        Ethplorer.Storage.init();
        Ethplorer.pageSize = Ethplorer.Storage.get('pageSize', 10);
        if(Ethplorer.pageSize > 10){
            Ethplorer.Nav.set('pageSize', Ethplorer.pageSize);
        }
        if(Ethplorer.Nav.get('pageSize')){
            Ethplorer.pageSize = Ethplorer.Nav.get('pageSize');
        }
        if(Ethplorer.Nav.get('filter')){
            var filter = Ethplorer.Nav.get('filter');
            if(filter){
                filter = filter.toLowerCase();
                if(Ethplorer.checkFilter(filter)){
                    Ethplorer.filter = filter;
                    Ethplorer.Nav.set('filter', Ethplorer.filter);
                    $('.filter-clear').show();
                    $('#filter_list').val(Ethplorer.filter);
                    $('#filter_list').addClass('filled');
                }else{
                    Ethplorer.Nav.del('filter');
                }
            }
        }
        Ethplorer.maxListSize = 0;
        Ethplorer.showTx = Ethplorer.Storage.get('showTx', 'all');
        var showTxHash = window.location.hash.substr(1);
        if(showTxHash){
            aShowTxHash = showTxHash.split('=');
            if(aShowTxHash.length > 1 && (aShowTxHash[0] == 'showTx') && (['all', 'eth', 'tokens'].indexOf(aShowTxHash[1]) >= 0)){
                Ethplorer.showTx = aShowTxHash[1];
                Ethplorer.Storage.set('showTx', aShowTxHash[1]);
            }
        }
        Ethplorer.route();
        $('#network').text(Ethplorer.Config.testnet ? 'Test' : 'Modern');
        $('.navbar-nav li[data-page]').click(function(){
            if($(this).hasClass('active')) return;
            if(!$('#loader:visible').length){
                $('.content-page:visible').hide();
                $('#' + $(this).attr('data-page')).show();
                $('.navbar-nav li').removeClass('active');
                $(this).addClass('active');
            }
        });
        $(document).on('click', '.tx-details-link', function(){
            Ethplorer.Storage.set('tx-details-block', 'open');
            $('.tx-details-link').addClass('closed');
            $('#tx-details-block').show();
            $("#tx-details-block").find("tr:visible:odd").addClass("odd");
            $("#tx-details-block").find("tr:visible:even").addClass("even");
            $("#tx-details-block").find("tr:visible:last").addClass("last");
        });
        $(document).on('click', '.tx-details-close', function(){
            Ethplorer.Storage.set('tx-details-block', 'closed');
            $('.tx-details-link').removeClass('closed');
            $('#tx-details-block').hide();
        });
        $(document).on('click', '[data-toggle="tab"]', function(){
            Ethplorer.Nav.set('tab', $(this).parent().attr('id'));
            var activeTab = Ethplorer.getActiveTab();
            if(activeTab){
                if(activeTab != 'transfers'){
                    $('#showTxChecks').hide();
                }else{
                    $('#showTxChecks').show();
                }
            }
            if(Ethplorer.data) Ethplorer.showFilter(Ethplorer.data);
        });
        $('.download').click(function(){
            var date = new Date();
            var hashDate = date.getFullYear() + '-' + (date.getMonth() + 1) + '-' + date.getDate();
            var href = $(this).attr("href");
            if(href.indexOf('&hash') == -1){
                href += '&hash=' + md5($(this).attr("href") + hashDate);
            }
            var showTx = Ethplorer.Storage.get('showTx', 'all');
            if(showTx){
                href += '&showTx=' + showTx;
            }

            $(this).attr("href", href);
            /*$('.export-csv').hide();
            $('.export-csv-spinner').show();
            Ethplorer.downloadData($(this).attr('data-address'));*/
        });
        if(Ethplorer.Nav.get('tab')){
            $('#' + Ethplorer.Nav.get('tab') +' a').click();
        }
        $('.filter-clear').click(function(){
            $('#filter_list').val('');
            $('.filter-form').trigger('submit');
        });
        $('.filter-form').submit(function(e){
            e.preventDefault();
            var filter = $('#filter_list').val().toLowerCase();
            if(Ethplorer.filter != filter){
                if(filter){
                    if(Ethplorer.checkFilter(filter)){
                        $('.filter-clear').show();
                        Ethplorer.Nav.set('filter', filter);
                        Ethplorer.Nav.del('transfers');
                        $('#filter_list').addClass('filled');
                    }else{
                        if(!$('#filter-error').length){
                            var errDiv = $('<div id="filter-error">');
                            errDiv.addClass("col-xs-12 text-right");
                            errDiv.text('Invalid filter value');
                            $('.filter-box').after(errDiv);
                            $('#filter-error').show(500, function(){
                                setTimeout(function(){
                                    $('#filter-error').hide(500, function(){
                                        $('#filter-error').remove();
                                    });
                                }, 3000);
                            });
                        }
                        return;
                    }
                }else{
                    $('.filter-clear').hide();
                    $('#filter_list').removeClass('filled');
                    Ethplorer.Nav.del('filter');
                }
                Ethplorer.filter = filter;
                Ethplorer.showTableLoader();
                $('#filter_list').attr('disabled', true)

                // Reload active tab, set other tabs as need to reload
                Ethplorer.reloadTab(false, true);
            }
        });
        $('.nav-tabs li a').click(function(){
            var tabName = $(this).parent().attr('id').replace('tab-', '');
            if(('undefined' !== typeof(Ethplorer.reloadTabs)) && (Ethplorer.reloadTabs.indexOf(tabName) >= 0)){
                Ethplorer.reloadTab(tabName, false);
            }
            setTimeout(function(){
                $("table").find("tr:visible:last").addClass("last");
            }, 300);
        });
        var blockStatus = Ethplorer.Storage.get('tx-details-block', 'open');
        if('open' === blockStatus){
            $('.tx-details-link').addClass('closed');
            $('#tx-details-block').show();
        }else{
            $('.tx-details-link').removeClass('closed');
            $('#tx-details-block').hide();
        }

        // @see ethplorer-search.js
        // @todo extension
        if('undefined' !== typeof(EthplorerSearch)){
            EthplorerSearch.init($('#search-form'), $('#search'), Ethplorer.search);
        }

        // @see ethplorer-adv.js
        // @todo extension
        if('undefined' !== typeof(EthplorerNote)){
            EthplorerNote.init($('#ethplorer-note'));
        }

        // Initialize extensions
        if(Ethplorer.Extensions){
            for(var ext in Ethplorer.Extensions){
                Ethplorer.Extensions[ext].init();
            }
        }

        // implement save to file function
        /*Ethplorer.saveData = function(data, name, mimetype){
            var file = new File([data], name, {type: mimetype + ";charset=utf-8"});
            saveAs(file);
            saveAs(
                  new Blob(
                      [data]
                    , {type: mimetype}
                )
                , name
            );
        };

        var URL = window.URL || window.webkitURL || window.mozURL || window.msURL;
        if(Blob && URL){
            Ethplorer.saveData = function(data, name, mimetype){
                var blob, url;
                if(!mimetype) mimetype = 'application/octet-stream';
                if('download' in document.createElement('a')){
                    blob = new Blob([data], {type: mimetype});
                    url = URL.createObjectURL(blob);
                    var link = document.createElement('a');
                    link.setAttribute('href', url);
                    link.setAttribute('download', name || 'ethplorer.data');
                    var event = document.createEvent('MouseEvents');
                    event.initMouseEvent('click', true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
                    link.dispatchEvent(event);
                }
                setTimeout(function(){ URL.revokeObjectURL(url); }, 250);
            };
        }else if(!/\bMSIE\b/.test(navigator.userAgent)){
            Ethplorer.saveData = function(data, name, mimetype){
                if(!mimetype) mimetype = 'application/octet-stream';
                window.open("data:" + mimetype + "," + encodeURIComponent(data), '_blank', '');
            };
        }*/
        this.Utils.initScrollable();
    },
    getActiveTab: function(){
        var tab = ($('.nav-tabs:visible li.active').length) ? $('.nav-tabs:visible li.active').attr('id').replace('tab-', '') : false;
        if(!tab){
            if($('#address-transfers:visible').length){
                tab = 'transfers';
            }
            if($('#address-chainy-tx:visible').length){
                tab = 'chainy';
            }
        }
        return tab;
    },
    reloadTab: function(name, reloadOthers){
        var tabs = ['transfers', 'issuances', 'chainy', 'holders'];
        if(!name){ // Get active tab if name not set
            name = Ethplorer.getActiveTab();
        }
        if(tabs.indexOf(name) < 0){
            return;
        }
        var methodName = 'draw' + name[0].toUpperCase() + name.substr(1);
        if('undefined' !== typeof(Ethplorer[methodName])){
            Ethplorer.showTableLoader();
            Ethplorer.loadAddressData(Ethplorer.currentAddress, {refresh: name}, Ethplorer[methodName]);
        }
        if(reloadOthers){
            Ethplorer.reloadTabs = tabs;
        }
        if(('undefined' !== typeof(Ethplorer.reloadTabs)) && (Ethplorer.reloadTabs.indexOf(name) >= 0)){
            delete Ethplorer.reloadTabs[Ethplorer.reloadTabs.indexOf(name)];
        }
    },
    checkFilter: function(filter){
        return (!filter || /^[0-9a-fx]+$/.test(filter));
    },
    route: function(){
        var pathData  = Ethplorer.Utils.parsePath();
        switch(pathData.cmd){
            case 'tx':
                Ethplorer.getTxDetails(pathData.arg);
                break;
            case 'address':
                Ethplorer.getAddressDetails(pathData.arg);
                break;
            case 'search':
                Ethplorer.search(pathData.arg);
                break;
            default:
                Ethplorer.error('Invalid request');
        }
    },
    error: function(message, addationalInfo = ''){
        Ethplorer.hideLoader();
        $('.content-page').hide();
        if (addationalInfo.length) {
            $('#error-with-details').show();
            $('#error').hide();
            $('#error-with-details .error-title').text(message);
            $('#error-with-details .error-details').html(addationalInfo);
        } else {
            $('#error').show();
            $('#error-with-details').hide();
            $('#error-reason').text(message);
        }
        $('#error').show();
        $('#ethplorer-path').hide();
    },
    getTxErrorReason: function(reason){
        var aReasons = {
            out_of_gas: 'Out of gas'
        };
        return ('undefined' !== typeof(aReasons[reason])) ? aReasons[reason] : reason;
    },
    getTxDetails: function (txHash, abi){
        Ethplorer.showLoader();

        // Check TX hash format first
        txHash = txHash.toLowerCase();
        if(!/^0x[0-9a-f]{64}$/i.test(txHash)){
            Ethplorer.gaSendEvent('ethpPageView', 'viewTx', 'tx-invalid-hash');
            Ethplorer.error('Invalid transaction hash');
            return;
        }
        var requestData = {data: txHash};
        if(Ethplorer.debug){
            requestData.debugId = Ethplorer.debugId;
        }
        var stopCheckingPendingAt = Date.now() + 1800000; // after 30 minutes
        function loadTxDetails(showResult = true) {
            $.getJSON(Ethplorer.service, requestData)
                .done(function(_txHash){
                    return function(data){
                        if(data.debug){
                            Ethplorer.requestDebug = data.debug;
                        }
                        if(data.ethPrice){
                            Ethplorer.ethPrice = data.ethPrice;
                        }
                        if(showResult) {
                            // if transaction is pending need send ga event
                            if (data.pending) {
                                Ethplorer.gaSendEvent('ethpPageView', 'viewTx', 'tx-pending');
                            }
                            Ethplorer.showTxDetails(_txHash, data);
                        } else if (!data.pending) {
                            // Transaction not pending anymore. Reloading the view.
                            location.reload();
                        }
                        // is transaction is pending
                        if(data.pending && stopCheckingPendingAt > Date.now()){
                            setTimeout(function() {
                                loadTxDetails(false);
                            }, 30000); // every 30 seconds
                        }
                    }
                    if(data.ethPrice){
                        Ethplorer.ethPrice = data.ethPrice;
                    }
                    Ethplorer.showTxDetails(_txHash, data);
                }(txHash))
                .fail(function() {
                    // Try send request again after 30 seconds
                    setTimeout(function() {
                        loadTxDetails(false);
                    }, 30000);
                });
        }
        loadTxDetails();
    },
    knownContracts: [],
    dataFields: {},
    showOpDetails: function(oTx, op){
        var titleAdd = '';
        var oToken = Ethplorer.prepareToken(op.token);
        var tokenName = ('N/A' !== oToken.name) ? oToken.name : '[ERC20]';
        titleAdd += (tokenName + ' ');
        $('.token-name:eq(0)').html(Ethplorer.Utils.getEthplorerLink(oToken.address, tokenName, false));
        $('.token-name:eq(1)').html(Ethplorer.Utils.getEthplorerLink(oToken.address, oToken.name , false));
        var txData = {tx: oTx, operation: op, token: oToken};

        $('.token-related td.list-field').empty();
        Ethplorer.fillValues('transaction', txData, ['token', 'token.timestamp', 'token.contract', 'token.symbol', 'token.price', 'token.decimals', 'token.owner']);
        var totalSupply = oToken.totalSupply;
        if(oToken.price && oToken.price.rate){
            var pf = parseFloat(totalSupply.replace(/\,/g,'').split(' ')[0]);
            if(pf){
                pf = Ethplorer.Utils.round(pf * oToken.price.rate, 2);
                if(pf < 1e+12){
                    pf = Ethplorer.Utils.formatNum(pf, true, 2, true);
                }else{
                    pf = "--";
                }
                totalSupply = totalSupply + '<br><span class="total-supply-usd">$&nbsp;' + pf + '</span>';
                $('#transaction-token-totalSupply').html(totalSupply);
            }
        }

        if(oToken.estimatedDecimals){
            $('#transaction-token-decimals').append(' <small>(estimated)</small>');
        }

        $('#transfer-tx-timestamp').html($('#transaction-tx-timestamp').html());

        if($('#transaction-tx-message').html()){
            $('#transfer-tx-message').html($('#transaction-tx-message').html());
            $('#transaction-tx-message').html('')
        }
        var oOperation = txData.operation;
        // Temporary workaround
        if(oOperation.type == 'Mint'){
            oOperation.type = 'Issuance';
        }

        var valFloat = parseFloat(Ethplorer.Utils.toBig(oOperation.value).toString());
        if('undefined' !== typeof(oOperation.formatted)){
            if(Ethplorer.Utils.isSafari()){
                oOperation.value = valFloat;
            }else{
                oOperation.value = Ethplorer.Utils.toBig(oOperation.value).div(Math.pow(10, oToken.decimals));
            }
            oOperation.value = Ethplorer.Utils.formatNum(oOperation.value, true, oToken.decimals, true, true);
            oOperation.value = oToken.symbol ? (oOperation.value + ' ' + oToken.symbol) : oOperation.value;
            oOperation.formatted = true;
        }
        var value = oOperation.value;
        if(valFloat && oToken.price && oToken.price.rate){
            value = value + '<br><span class="tx-value-price">$&nbsp;' + Ethplorer.Utils.formatNum(oToken.price.rate * valFloat, true, 2, true, true) + '</span>';
            value += getHistDiffPriceString(op.usdPrice, oToken.price.rate);
        }
        $('#transfer-operation-value').html(value);

        $('#historical-price').html(getHistUsdPriceString(op.usdPrice, valFloat));


        titleAdd += oOperation.type;
        $('.token-operation-type').text(oOperation['type']);
        Ethplorer.fillValues('transfer', txData, ['operation', 'operation.from', 'operation.to']);
        if(oTx.blockNumber){
            $('#txTokenStatus')[oOperation.success ? 'removeClass' : 'addClass']('text-danger');
            $('#txTokenStatus')[oOperation.success ? 'addClass' : 'removeClass']('text-success');
            $('#txTokenStatus').html(oOperation.success ? 'Success' : 'Failed' + (oOperation.failedReason ? (': ' + Ethplorer.getTxErrorReason(oOperation.failedReason)) : ''));
            $('#operation-status').addClass(oOperation.success ? 'green' : 'red');
        }
        //document.title = 'Ethplorer: ' + (titleAdd ? (titleAdd + ' -') : '');
        Ethplorer.Utils.hideEmptyFields();
    },
    showTxDetails: function(txHash, txData){
        // $('#ethplorer-path').html('<h1>Transaction hash: ' + txHash + '</h1>');
        $('#ethplorer-path').show();
        if (txData.pending && txData.tx && txData.tx.blockNumber) {
            $('#ethplorer-path').html($('#ethplorer-path').text() + '<br /><h4 class="text-danger tx-pending">Processing transaction&nbsp;&nbsp;<i class="table-loading fa fa-spinner fa-spin"></i></h4>')
        } else if (txData.pending) {
            $('#ethplorer-path').html($('#ethplorer-path').text() + '<br /><h4 class="text-danger tx-pending">Pending transaction&nbsp;&nbsp;<i class="table-loading fa fa-spinner fa-spin"></i></h4>')
        }

        $('.list-field').empty();
        $('#transaction-tx-hash').html(Ethplorer.Utils.getEtherscanLink(txHash));
        $('.token-related')[txData.token ? 'show' : 'hide']();
        $('#tx-status, #operation-status').removeClass('green red');

        var oTx = txData.tx;
        if(false === oTx){
            Ethplorer.gaSendEvent('ethpPageView', 'viewTx', 'tx-not-found');
            Ethplorer.error(
                'Transaction not found',
                'If transaction was created recently, it may not have reached mempool yet.<br/> Wait a minute and try to <a href="javascript:void()" onClick="Ethplorer.gaSendEvent(\'ethpPageView\', \'viewTx\', \'refresh\'); setTimeout(function() {location.reload();}, 1000)">refresh</a> the page.'
            );
            return;
        }

        Ethplorer.knownContracts = txData.contracts ? txData.contracts : [];

        if(oTx.blockNumber && !txData.pending){
            $('#txEthStatus')[oTx.success ? 'removeClass' : 'addClass']('text-danger');
            $('#txEthStatus')[oTx.success ? 'addClass' : 'removeClass']('text-success');
            $('#txEthStatus').html(oTx.success ? 'Success' : 'Failed' + (oTx.failedReason ? (': ' + Ethplorer.getTxErrorReason(oTx.failedReason)) : ''));
            $('#tx-status').addClass(oTx.success ? 'green' : 'red');
        } else if (oTx.blockNumber && txData.pending) {
            $('#txEthStatus').removeClass('text-danger text-success');
            $('#txEthStatus').html('Processing'); 
        } else {
            $('#txEthStatus').removeClass('text-danger text-success');
            $('#txEthStatus').html('Pending');
        }

        var titleAdd = '';

        $('#tx-parsed').hide();
        if(oTx.input && oTx.input.length){
            oTx.input = oTx.input.toUpperCase().replace(/^0x/i, '');
            Ethplorer.dataFields['transaction-tx-input'] = {
                hex: oTx.input,
                ascii: Ethplorer.Utils.hex2ascii(oTx.input)
            };
            var obj = Ethplorer.Utils.parseJData(oTx.input);
            var isChainy = false;
            // QUESTION: need explanation
            if(oTx.to && ('0xf3763c30dd6986b53402d41a8552b8f7f6a6089b' === oTx.to)){
                var input = Ethplorer.Utils.hex2ascii(oTx.input.substring(136).replace(/0+$/, ''));
                try {
                    obj = JSON.parse(input);
                }catch(e){
                    // console.log(e.message);
                    // console.log(input);
                }
                Ethplorer.dataFields['transaction-tx-input']['ascii'] = input;
                if(('undefined' !== typeof(obj['id'])) && ('CHAINY' === obj['id'])){
                    // Chainy transaction
                    var chainyTypes = {
                        'R': 'Redirect',
                        'T': 'Text',
                        'H': 'Hash',
                        'L': ('undefined' !== typeof(obj['url'])) ? 'File Link' : 'File Hash',
                        'E': 'Encrypted'
                    };
                    titleAdd = 'Chainy ' + chainyTypes[obj['type']];
                    $('#chainy-op').text(chainyTypes[obj['type']]);
                    if('undefined' !== typeof(obj['url'])){
                        $('#chainy-url').html('<a href="' + obj['url'] + '" target="_blank" class="external-link"><i class="fa fa-external-link-alt"></i>&nbsp;' + obj['url'] + '</a>');
                    }
                    var aFields = ['hash', 'filename', 'filesize', 'description'];
                    for(var f = 0; f < aFields.length; f++){
                        var fld = aFields[f];
                        if('undefined' !== typeof(obj[fld])){
                            $('#chainy-' + fld).text(obj[fld]);
                        }
                    }
                    var log = oTx.receipt && oTx.receipt.logs && oTx.receipt.logs.length ? oTx.receipt.logs[0] : false;
                    if(log && log.topics && log.topics.length && (0 === log.topics[0].indexOf("0xdad5c"))){
                        try {
                            var data = log.data.slice(194).replace(/0+$/, '');
                            var link = Ethplorer.Utils.hex2ascii(data);
                            $('#chainy-link').html('<a href="' + link + '" target="_blank" class="local-link"><i class="fa fa-external-link-alt"></i>&nbsp;' + link + '</a>');
                        }catch(e){}
                    }
                    $('.chainy').show();
                    isChainy = true;
                }
            }
            if(false !== obj){
                $('#transaction-tx-parsed').text(JSON.stringify(obj, null, 4));
                $('#tx-parsed').show();
                if(obj.description){
                    var msg = obj.description;
                    if(obj.link){
                        msg = msg + ' ' + obj.link;
                    }
                    var msgid = isChainy ? "#chainy-message" : '#transaction-tx-message';
                    msg = $('<span>').text(msg).html();
                    msg = msg.replace(/http[s]?\:\/\/[^\s]*/g, '<a href="$&" target="_blank">$&</a>');
                    msg = msg.replace(/~~~(.*)~~~\n?/g, '<h4>$1</h4>');
                    msg = msg.replace(/\n/g, '<br />');
                    $(msgid).html(msg);
                }
            }
        }
        if(txData.tx.gasPrice){
            txData.tx.gasPrice = parseFloat(Ethplorer.Utils.toBig(txData.tx.gasPrice).toString());
            if (!txData.pending) {
                txData.tx.cost =  txData.tx.gasUsed ? txData.tx.gasPrice * txData.tx.gasUsed : 0;
            }
        }
        Ethplorer.fillValues('transaction', txData, ['tx', 'tx.from', 'tx.to', 'tx.creates', 'tx.value', 'tx.timestamp', 'tx.gasLimit', 'tx.gasUsed', 'tx.gasPrice', 'tx.fee', 'tx.nonce', 'tx.blockNumber', 'tx.confirmations', 'tx.input', 'tx.cost', 'tx.method']);

        if(txData.token){
            var oToken = Ethplorer.prepareToken(txData.token);
            var tokenName = ('N/A' !== oToken.name) ? oToken.name : '[ERC20]';
            titleAdd += (tokenName + ' ');
            $('.token-name:eq(0)').html(Ethplorer.Utils.getEthplorerLink(oToken.address, tokenName, false));
            $('.token-name:eq(1)').html(Ethplorer.Utils.getEthplorerLink(oToken.address, oToken.name , false));

            if(oToken.image){
                var img = Ethplorer.Utils.getEthplorerLink(oToken.address, '##IMG##', false);
                $('.token-related:eq(1) .block-header').find('img').remove();
                $('.token-related:eq(1) .block-header').prepend(
                    img.replace('##IMG##', '<img src="' + oToken.image + '" style="max-width:32px;max-height:32px;margin:8px;margin-left:20px;" align="left">')
                );
            }

            txData.token = oToken;

            Ethplorer.fillValues('transaction', txData, ['token', 'token.timestamp', 'token.contract', 'token.symbol', 'token.price', 'token.decimals', 'token.owner', 'token.totalSupply']);
            var totalSupply = oToken.totalSupply;
            if(oToken.price && oToken.price.rate){
                var pf = parseFloat(totalSupply.replace(/\,/g,'').split(' ')[0]);
                if(pf){
                    pf = Ethplorer.Utils.round(pf * oToken.price.rate, 2);
                    if(pf < 1e+12){
                        pf = Ethplorer.Utils.formatNum(pf, true, 2, true);
                    }else{
                        pf = "--";
                    }
                    totalSupply = totalSupply + '<br><span class="total-supply-usd">$&nbsp;' + pf + '</span>';
                    $('#transaction-token-totalSupply').html(totalSupply);
                }
            }

            if(oToken.estimatedDecimals){
                $('#transaction-token-decimals').append(' <small>(estimated)</small>');
            }

            if($('#transaction-tx-message').html()){
                $('#transfer-tx-message').html($('#transaction-tx-message').html());
                $('#transaction-tx-message').html('')
            }

            if(txData.operations && txData.operations.length){
                txData.operation = txData.operations[txData.operations.length - 1];
                var multiop = txData.operations.length > 1;
                for(var i=0; i<txData.operations.length; i++){
                    var idx = i;
                    var op = txData.operations[idx];
                    var pos = ('undefined' !== typeof(op.priority)) ? op.priority : idx;
                    op.index = idx;
                    var opToken = Ethplorer.prepareToken(op.token);
                    var valFloat = 0;
                    if('undefined' !== typeof(op.value)){                       
                        valFloat = parseFloat(Ethplorer.Utils.toBig(op.value).toString());                        
                        valFloat = valFloat / Math.pow(10, opToken.decimals);
                        if(Ethplorer.Utils.isSafari()){
                            op.value = valFloat;
                        }else{
                            op.value = Ethplorer.Utils.toBig(op.value).div(Math.pow(10, opToken.decimals));
                        }
                        op.value = Ethplorer.Utils.formatNum(op.value, true, opToken.decimals, true, true);
                        // op.value = opToken.symbol ? (op.value + ' ' + opToken.symbol) : op.value;
                        op.symbol = opToken.symbol;
                    }

                    var opParties = '';
                    if(op.address){
                        op.to = op.address;
                        var address = op.address;
                        opParties = '<span class="cuttable-address">for ' + address + '</span>';
                    }else if(op.from && op.to){
                        var from = '<span class="cuttable-address">from ' + op.from + '</span>';
                        var to = '<span class="cuttable-address">to ' + op.to + '</span>';
                        opParties = from + '<br class="show_small"> ' + to;
                    }
                    if(multiop){
                        var row = $(
                            '<tr data-op-idx="' + pos + '">' +
                            '<td><a class="dashed">Details</a></td>' +
                            '<td><span class="dash_on_hover">' + op.type.toString().toUpperCase() +
                            '<span class="show_small"> ' + op.value + ' ' + op.symbol + '</span>' +
                            '<br class="show_small"> ' + opParties + '</span></td>' +
                            '<td class="text-right"><span class="dash_on_hover">' + op.value + '</span></td>' +
                            '<td><span class="dash_on_hover">' + op.symbol + '</span></td>' +
                            '<td></td>' +
                            '</tr>'
                        );
                        row[0].operation = op;
                        row.click(function(_tx){
                            return function(){
                                if($(this).hasClass('selectable')){
                                    $(this).removeClass('selectable');
                                    $('.multiop .blue').addClass('selectable');
                                    $('.multiop .blue').removeClass('blue');
                                    $(this).addClass('blue');
                                    $('.token-related').animate({opacity:0.1}, 250, function(){
                                        $('.token-related').animate({opacity:1}, 250);
                                    });
                                    setTimeout(function(__tx, _op){
                                        return function(){
                                            Ethplorer.showOpDetails(__tx, _op);
                                        };
                                    }(_tx, this.operation), 250);
                                    Ethplorer.Nav.set('opIdx', ('undefined' !== typeof(this.operation.priority)) ? this.operation.priority : this.operation.index)
                                }
                            };
                        }(oTx));
                        $('.multiop table').append(row);
                    }
                }
                if(multiop){
                    $('.multiop table tr').addClass('selectable');
                    $('.multiop table tr:eq(0)').removeClass('selectable').addClass('blue');
                    $('.multiop .block-header h3').text(txData.operations.length + ' internal operations found');
                    $('.multiop').show();
                }

                var oOperation = txData.operation;
                // Temporary workaround
                if(oOperation.type == 'Mint'){
                    oOperation.type = 'Issuance';
                }
                titleAdd += oOperation.type;
                $('.token-operation-type').text(oOperation.type);
                Ethplorer.fillValues('transfer', txData, ['operation', 'operation.from', 'operation.to']);
                if(oOperation.value){
                    var value = oOperation.value;
                    if(valFloat && oToken.price && oToken.price.rate){
                        value = value + '<br><span class="tx-value-price">$&nbsp;' + Ethplorer.Utils.formatNum(oToken.price.rate * valFloat, true, 2, true, true) + '</span>';
                        value += getHistDiffPriceString(oOperation.usdPrice, oToken.price.rate);
                    }
                    $('#transfer-operation-value').html(value);
                    $('#historical-price').html(getHistUsdPriceString(oOperation.usdPrice, valFloat));
                }

                if(oTx.blockNumber && !txData.pending){
                    $('#txTokenStatus')[oOperation.success ? 'removeClass' : 'addClass']('text-danger');
                    $('#txTokenStatus')[oOperation.success ? 'addClass' : 'removeClass']('text-success');
                    $('#txTokenStatus').html(oOperation.success ? 'Success' : 'Failed' + (oOperation.failedReason ? (': ' + Ethplorer.getTxErrorReason(oOperation.failedReason)) : ''));
                    $('#operation-status').addClass(oOperation.success ? 'green' : 'red');
                } else if (oTx.blockNumber && txData.pending) {
                    $('#txTokenStatus').removeClass('text-danger text-success');
                    $('#txTokenStatus').html('Processing'); 
                } else {
                    $('#txTokenStatus').removeClass('text-danger text-success');
                    $('#txTokenStatus').html('Pending'); 
                }
            }else{
                titleAdd += 'Operation';
                $('.token-operation-type').text('Operation');
                if(oTx.receipt && oTx.receipt.logs && oTx.receipt.logs.length){
                    for(var i=0; i<oTx.receipt.logs.length; i++){
                        var log = oTx.receipt.logs[i];
                        // Error event
                        if(log.topics && log.topics.length && (0 === log.topics[0].indexOf('0x19f3a4'))){
                            oTx.success = false;
                            oTx.failedReason = Ethplorer.Utils.hex2ascii(log.data.substr(192))
                            break;
                        }
                    }
                }
                if(oTx.blockNumber){
                    $('#txTokenStatus')[oTx.success ? 'removeClass' : 'addClass']('text-danger');
                    $('#txTokenStatus')[oTx.success ? 'addClass' : 'removeClass']('text-success');
                    $('#txTokenStatus').html(oTx.success ? 'Success' : 'Failed' + (oTx.failedReason ? (': ' + Ethplorer.getTxErrorReason(oTx.failedReason)) : ''));
                    $('#operation-status').addClass(oTx.success ? 'green' : 'red');
                }
            }
            if(!oTx.blockNumber && txData.pending){
                $('#txTokenStatus').removeClass('text-danger text-success');
                $('#txTokenStatus').html('Pending');
            } else if (oTx.blockNumber && txData.pending) {
                $('#txTokenStatus').removeClass('text-danger text-success');
                $('#txTokenStatus').html('Processing');
            }
            Ethplorer.fillValues('transfer', txData, ['tx', 'tx.timestamp']);
        }else{
            if (
                (Ethplorer.Storage.get('showTx') === 'all' || Ethplorer.Storage.get('showTx') === 'eth') &&
                (!txData.tx.operations || !txData.tx.operations.length) &&
                txData.tx.value > 0 &&
                txData.tx.success !== false
            ) {
                $('#token-operation-block').show();
                $('#token-operation-block .token-name:eq(0)').html('ETH');
                $('.token-operation-type').text('Transfer');
                txData.operation = {
                    from: txData.tx.from,
                    to: txData.tx.to,
                    valueEth: txData.tx.value,
                    success: txData.tx.success,
                    usdPrice: txData.tx.usdPrice
                }
                
                var operationFields = ['operation', 'operation.from', 'operation.to']; 
                var value = Ethplorer.Utils.formatNum(txData.tx.value, true, 18, true, true) + '&nbsp;<i class="fab fa-ethereum"></i>&nbsp;ETH';
                if (txData.tx.success) {
                    // Custom price value
                    if(txData.tx.value && Ethplorer.ethPrice.rate) {
                        value += '<br><span class="tx-value-price">$&nbsp;' + Ethplorer.Utils.formatNum(Ethplorer.ethPrice.rate * txData.tx.value, true, 2, true, true) + '</span>';
                        if (txData.tx.usdPrice) {
                            value += getHistDiffPriceString(txData.tx.usdPrice, Ethplorer.ethPrice.rate);
                            // Price of eth on transaction exceute
                            $('#historical-price').html(getHistUsdPriceString(txData.tx.usdPrice, txData.tx.value));
                        }
                    }
                    $('#transfer-operation-value').html(value);
                } else {
                    // if no history show with using fillValues
                    operationFields.push('operation.valueEth');
                }

                Ethplorer.fillValues('transfer', txData, operationFields);
                Ethplorer.fillValues('transfer', txData, ['tx', 'tx.timestamp']);

                if(oTx.blockNumber && !txData.pending){
                    $('#txTokenStatus')[txData.operation.success ? 'removeClass' : 'addClass']('text-danger');
                    $('#txTokenStatus')[txData.operation.success ? 'addClass' : 'removeClass']('text-success');
                    $('#txTokenStatus').html(txData.operation.success ? 'Success' : 'Failed');
                    $('#operation-status').addClass(txData.operation.success ? 'green' : 'red');
                } else if (oTx.blockNumber && txData.pending) {
                    $('#operation-status').removeClass('text-danger text-success');
                    $('#txTokenStatus').html('Processing'); 
                } else {
                    $('#operation-status').removeClass('text-danger text-success');
                    $('#txTokenStatus').html('Pending');
                }
            }
            $('#tx-details-block').show();
            $('.tx-details-close').hide();
        }

        //document.title = 'Ethplorer';
        //document.title += (': ' + (titleAdd ? (titleAdd + ' -') : ''));
        //document.title += (' hash ' + txHash);

        var idx = Ethplorer.Nav.get('opIdx');
        if(false !== idx){
            idx = parseInt(idx);
            var el = $('[data-op-idx=' + idx + ']');
            if(el.length && ('undefined' !== typeof(el[0].operation))){
                $('.multiop .blue').addClass('selectable');
                $('.multiop .blue').removeClass('blue');
                el.addClass('blue');
                el.removeClass('selectable');
                Ethplorer.showOpDetails(oTx, el[0].operation);
                setTimeout(function(){
                    el[0].scrollIntoView({behavior: "instant", inline: "center"})
                }, 0)
            }
        }else if(multiop){
            Ethplorer.showOpDetails(oTx, txData.operations[0]);
        }

        Ethplorer.Events.fire('ethp_showTxDetails_finish', txData);
        Ethplorer.Utils.hideEmptyFields();
        Ethplorer.hideLoader();
        $('#disqus_thread').show();
        $('#txDetails').show();
        $("table").find("tr:visible:odd").addClass("odd");
        $("table").find("tr:visible:even").addClass("even");
        $("table").find("tr:visible:last").addClass("last");
        
        Ethplorer.gaSendEvent('ethpPageView', 'viewTx', 'tx-ok');
    },
    getAddressDetails: function(address){
        // Check Address format first
        address = address.toLowerCase();
        if(!Ethplorer.Utils.isAddress(address)){
            Ethplorer.error('Invalid address format');
            return;
        }
        Ethplorer.loadAddressData(address, Ethplorer.showAddressDetails);
    },
    loadAddressData: function(address, data, callback){
        if('function' === typeof(data)){
            callback = data;
            var data = {};
        }
        data.data = address;
        var page = Ethplorer.Nav.getString();
        if(page){
            data.page = page;
        }
        if(Ethplorer.debug){
            data.debugId = Ethplorer.debugId;
        }
        if(Ethplorer.showTx){
            data.showTx = Ethplorer.showTx;
        }
        $.getJSON(Ethplorer.service, data, function(_address){
            return function(data){
                if(data.debug){
                    Ethplorer.requestDebug = data.debug;
                }
                if(data.ethPrice){
                    Ethplorer.ethPrice = data.ethPrice;
                }
                callback(_address, data);
                if(Ethplorer.data) Ethplorer.showFilter(Ethplorer.data);
            }
        }(address));
    },
    showAddressDetails: function(address, data){
        var srcAddress = address;
        address = Ethplorer.Utils.toChecksumAddress(address);
        Ethplorer.currentAddress = address;
        Ethplorer.data = data;
        var titleAdd = '';
        // Temporary hack
        $('.address-type').text(data.isContract ? 'Contract' : 'Address');
        $('#ethplorer-path').show();
        data.address = address;
        var aValues = ['address', 'balance'];
        if(data.balanceIn){
            aValues.push('balanceIn');
            if('undefined' === typeof(data.hideBalanceOut)){
                aValues.push('balanceOut');
            }
        }
        Ethplorer.fillValues('address', data, aValues);
        $('#address-token-balances, #address-token-details').hide();
        if(data.isContract && data.contract.isChainy){
            titleAdd = 'Chainy Information';
            Ethplorer.drawChainy(address, data);
            $('#address-chainy-info').show();
        }
        if(data.isContract){
            Ethplorer.fillValues('address', data, ['contract', 'contract.creator']);
        }
        var qrIcon = '<a style="float:right;position:relative;" href="javascript:void(0)" onclick="Ethplorer.showQRCode(\'' + address + '\');"><i class="fa fa-qrcode"></i></a>';
        if(data.isContract && data.token){
           
            qrIcon = '<a style="float:right;position:relative;line-height:48px;" href="javascript:void(0)" onclick="Ethplorer.showQRCode(\'' + address + '\');"><i class="fa fa-qrcode"></i></a>';
            $('#address-token-details').show();
            var oToken = Ethplorer.prepareToken(data.token);
            // oToken.address = oToken.address;
            // QUESTION: need explanation
            var ttype = (address.toLowerCase() !== "0x55d34b686aa8c04921397c5807db9ecedba00a4c") ? 'Token ' : 'Contract ';
            $('#ethplorer-path').html(qrIcon + ttype + oToken.name + '<br><small>' + Ethplorer.Utils.toChecksumAddress(oToken.address) + '</small>');
            titleAdd = ttype + oToken.name + (oToken.symbol ? (' [' + oToken.symbol + ']') : '' ) + ' Information';
            // Read description from tx
            if(data.contract && data.contract.code){
                var json = Ethplorer.Utils.parseJData(data.contract.code);
                if(json && json.description){
                    oToken.description = json.description;
                }
            }
            // Read from config
            if(Ethplorer.Config.tokens && ('undefined' !== typeof(Ethplorer.Config.tokens[oToken.address]))){
                if('undefined' !== typeof(Ethplorer.Config.tokens[oToken.address].description)){
                    oToken.description = Ethplorer.Config.tokens[oToken.address].description;
                }
            }
            // console.log(oToken);
            var showAlert = true; // document.location.hash && (document.location.hash.indexOf('showAlert') > 0);
            if(oToken.alert && showAlert){
                $('#ethplorer-alert').html(oToken.alert);
                $('#ethplorer-alert').show();
            }
            if(oToken.description){
                oToken.description = $('<span>').text(oToken.description).html();
                oToken.description = oToken.description.replace(/http[s]?\:\/\/[^\s]*/g, '<a href="$&" target="_blank">$&</a>');
                oToken.description = oToken.description.replace(/~~~(.*)~~~\n?/g, '<h4>$1</h4>');
                oToken.description = oToken.description.replace(/\n/g, '<br />');
            }else{
                oToken.description = '';
            }

            // Add website, social icons and other links
            if(oToken.description && (oToken.website || oToken.facebook || oToken.twitter || oToken.reddit || oToken.telegram)){
                oToken.description = oToken.description + '<br>';
            }
            if(oToken.website){
                if(oToken.description){
                    oToken.description = oToken.description + '<br>';
                }
                oToken.description = oToken.description + '<i class="fa fa-globe" title="Website" style="width:20px;"></i> <a href="' + oToken.website + '" target="_blank">' + oToken.website + '</a>';
            }
            if(oToken.facebook){
                oToken.description = oToken.description + '<br><i class="fab fa-facebook-f" title="Facebook" style="width:20px;"></i> <a href="https://facebook.com/' + oToken.facebook + '" target="_blank">' + oToken.facebook + '</a>';
            }
            if(oToken.twitter){
                oToken.description = oToken.description + '<br><i class="fab fa-twitter" title="Twitter" style="width:20px;"></i> <a href="https://twitter.com/' + oToken.twitter + '" target="_blank">' + oToken.twitter + '</a>';
            }
            if(oToken.reddit){
                oToken.description = oToken.description + '<br><i class="fab fa-reddit-alien" title="Reddit" style="width:20px;"></i> <a href="https://reddit.com/r/' + oToken.reddit + '" target="_blank">' + oToken.reddit + '</a>';
            }
            if(oToken.telegram){
                oToken.description = oToken.description + '<br><i class="fab fa-telegram" title="Telegram" style="width:20px;"></i> <a href="' + oToken.telegram + '" target="_blank">Join Channel</a>';
            }
            if(oToken.links){
                oToken.links = oToken.links.replace(/http[s]?\:\/\/[^\s]*/g, '<a href="$&" target="_blank">$&</a>');
                oToken.links = oToken.links.replace(/\n/g, '<br />');
                oToken.description = oToken.description + '<br><br>' + oToken.links;
            }

            if(oToken.image){
                $('#address-token-details .block-header').find('img').remove();
                $('#address-token-details .block-header').prepend('<img src="' + oToken.image + '" class="token-logo" align="left">');
            }
            $('.address-token-name').html(oToken.name);
            if(Ethplorer.Config.updateLink){
                $('.address-token-name:eq(0)').append('<a href="' + Ethplorer.Config.updateLink + '" target="_blank" class="token-update">Update</a>')
            }

            Ethplorer.drawHolders(srcAddress, data);
            Ethplorer.drawIssuances(srcAddress, data);

            if(data.pager && data.pager.transfers){
                data.token.transfersCount = data.pager.transfers.total;
                if(data.token.transfersCount > Ethplorer.maxListSize) Ethplorer.maxListSize = data.token.transfersCount;
            }
            if(data.pager && data.pager.issuances){
                data.token.issuancesCount = '';
                if(data.pager.issuances.total){
                    data.token.issuancesCount = data.pager.issuances.total;
                }
            }
            if(data.pager && data.pager.holders){
                data.token.holdersCount = data.pager.holders.total;
            }

            if(data.contract && data.contract.txsCount && (data.contract.txsCount > data.token.txsCount)){
                data.token.txsCount = data.contract.txsCount;
            }
            if(data.token && data.token.txsCount){
                if(data.token.txsCount > Ethplorer.maxListSize) Ethplorer.maxListSize = data.token.txsCount;
            }

            var fields = [
                'token', 'token.name', 'token.price', 'token.description', 'token.owner', 'token.totalSupply', 'token.totalIn', 'token.totalOut', 'token.decimals', 'token.symbol',
                'token.txsCount', 'token.transfersCount', 'token.issuancesCount', 'token.holdersCount', 'token.createdAt', 'token.createdTx'
            ];

            $('#tab-issuances').show();
            $('#tab-holders').show();

            Ethplorer.fillValues('address', data, fields);

            var totalSupply = oToken.totalSupply;
            if(oToken.price && oToken.price.rate){
                var pf = parseFloat(totalSupply.replace(/\,/g,'').split(' ')[0]);
                if(pf){
                    pf = Ethplorer.Utils.round(pf * oToken.price.rate, 2);
                    totalSupply = totalSupply + '<br><span class="total-supply-usd">$&nbsp;' + Ethplorer.Utils.formatNum(pf, true, 2, true) + '</span>';
                    $('#address-token-totalSupply').html(totalSupply);
                }
            }

            if(oToken.estimatedDecimals){
                $('#address-token-decimals').append(' <small>(estimated)</small>');
            }

            Ethplorer.gaSendEvent('ethpPageView', 'viewToken', oToken.name ? oToken.name : 'N/A');

        }else{
            // Fill prices
            var totalPrice = 0;
            var lastTotalPrice = 0;
            if(Ethplorer.ethPrice && Ethplorer.ethPrice.rate && data.balance){
                totalPrice = Ethplorer.ethPrice.rate * data.balance;
                if(Ethplorer.ethPrice.diff){
                    var lastEthRate = Ethplorer.ethPrice.diff > -100 ? (Ethplorer.ethPrice.rate / (1 + Ethplorer.ethPrice.diff / 100)) : 0;
                    lastTotalPrice += lastEthRate * data.balance;
                }
            }
            if(data.balances && data.balances.length){
                for(var k=0; k<data.balances.length; k++){
                    var balance = data.balances[k];
                    var oToken = Ethplorer.prepareToken(data.tokens[balance.contract]);
                    var qty = Ethplorer.Utils.toBig(balance.balance);
                    if(Ethplorer.Utils.isSafari()){
                        qty = parseFloat(qty.toString()) / Math.pow(10, oToken.decimals);
                    }else{
                        qty = qty.div(Math.pow(10, oToken.decimals));
                    }
                    var qFloat = parseFloat(qty.toString());
                    data.balances[k].qty = qty;
                    data.balances[k].price = false;
                    data.balances[k].balanceUSD = false;
                    if((qFloat > 0) && oToken.price && oToken.price.rate){
                        data.balances[k].price = oToken.price.rate;
                        data.balances[k].balanceUSD = oToken.price.rate * qFloat;
                        var lastRate = oToken.price.diff > -100 ? (oToken.price.rate / (1 + oToken.price.diff / 100)) : 0;
                        lastTotalPrice += qFloat * lastRate;
                        totalPrice += data.balances[k].balanceUSD;
                    }
                }
                // Sort
                var balances = data.balances.sort(function(a,b){
                    if(a.price && !b.price) return -1;
                    if(b.price && !a.price) return 1;
                    if(a.balanceUSD < b.balanceUSD)
                        return 1;
                    if (a.balanceUSD > b.balanceUSD)
                        return -1;
                    return 0;
                });
                // Show
                $('#address-token-balances table').empty();
                for(var k=0; k<balances.length; k++){
                    var balance = balances[k];
                    var oToken = Ethplorer.prepareToken(data.tokens[balance.contract]);
                    var row = $('<TR>');
                    var qty = balance.qty;
                    if(!parseFloat(qty.toString()) && !(balance.totalIn || balance.totalOut)){
                        // No balance and no movement - skip
                        continue;
                    }
                    var value = Ethplorer.Utils.formatNum(qty, true, oToken.decimals, true, true) + ' ' + oToken.symbol;
                    if(balances[k].price){
                        var rate = oToken.price;
                        var price = balances[k].balanceUSD;
                        value += ('<br><div class="balances-price" title="$' + price + '">$&nbsp;' + Ethplorer.Utils.formatNum(price, true, 2, true, true) + ' ');
                        if(rate.diff){
                            var cls = getDiffClass(rate.diff);
                            var hint = 'Updated at ' + Ethplorer.Utils.ts2date(rate.ts, true);
                            if(rate.diff > 0){
                                rate.diff = '+' + rate.diff;
                            }
                            value = value + ' <span class="' + cls + '" title="' + hint + '">(' + Ethplorer.Utils.round(rate.diff, 2) + '%)</span>'
                        }
                        value = value + '</div>';

                    }
                    // @temporary off
                    if(false && (balance.totalIn || balance.totalOut)){
                        value += '<br />';
                        var totalIn = Ethplorer.Utils.toBig(balance.totalIn);
                        var totalOut = Ethplorer.Utils.toBig(balance.totalOut);
                        if(Ethplorer.Utils.isSafari()){
                            totalIn = parseFloat(totalIn.toString()) / Math.pow(10, oToken.decimals);
                            totalOut = parseFloat(totalOut.toString()) / Math.pow(10, oToken.decimals);
                        }else{
                            totalIn = totalIn.div(Math.pow(10, oToken.decimals));
                            totalOut = totalOut.div(Math.pow(10, oToken.decimals));
                        }
                        value += ('<div class="total-in-out-small">Total In: ' + Ethplorer.Utils.formatNum(totalIn, true, oToken.decimals, true) + '<br />');
                        value += ('Total Out: ' + Ethplorer.Utils.formatNum(totalOut, true, oToken.decimals, true) + '</div>');
                    }
                    row.append('<td class="cut-long-text">' + Ethplorer.Utils.getEthplorerLink(balance.contract, oToken.name, false) + '</td>');
                    row.append('<td>' + value + '</td>');
                    row.find('td:eq(1)').addClass('text-right');
                    $('#address-token-balances table').append(row);
                }
            }

            var totalDiff = Ethplorer.Utils.round(Ethplorer.Utils.pdiff(totalPrice, lastTotalPrice), 2);
            if(totalPrice){
                var value = '~ $&nbsp;' + Ethplorer.Utils.formatNum(totalPrice, true, 2, true, true);
                if(totalDiff){
                    var cls = getDiffClass(totalDiff);
                    if(totalDiff > 0){
                        totalDiff = '+' + totalDiff;
                    }
                    value = value + ' <span class="' + cls + '">(' + Ethplorer.Utils.round(totalDiff, 2) + '%)</span>';
                }
                $('#address-balances-total').html('<span id="address-balances-total-inner" title="$' + totalPrice + '">' + value + '</span>');
            }else{
                $('#address-balances-total').html('&nbsp;');
            }
            Ethplorer.gaSendEvent('ethpPageView', 'viewAddress');
        }

        if(!data.isContract || !data.token){
            $('#addr-balance').addClass('blue');
            $('#addr-balance').addClass('even');
            $('#addr-balance').addClass('address-balance');
            $('.nav-tabs').hide();
            $('.filter-box').addClass('out-of-tabs');
            if(!$('#address-token-balances table tr').length){
                var row = $('<tr>');
                var cell = $('<td>');
                cell.html('No token balances found');
                row.append(cell);
                $('#address-token-balances table').append(row);
                $('#address-token-balances table').show();
                if(!totalPrice) $('#address-balances-total').remove();
            }
            $('#address-token-balances').show();
        }else{
            $('.filter-box').addClass('in-tabs');
        }

        if(!data.contract || !data.contract.isChainy){
            Ethplorer.drawTransfers(srcAddress, data);
        }

        /*if(data.token){
        }else{
            document.title = 'Ethplorer';
            document.title += (': ' + (titleAdd ? (titleAdd + ' -') : ''));
            document.title += ((data.isContract ? ' Ethereum contract ' : ' Ethereum address ') + Ethplorer.currentAddress);
        }*/

        Ethplorer.Events.fire('ethp_showAddressDetails_finish', data);

        $('.local-time-offset').text(Ethplorer.Utils.getTZOffset());
        Ethplorer.Utils.hideEmptyFields();
        Ethplorer.hideLoader();
        if(!data.isContract || (data.contract && data.contract.isChainy)) $('#ethplorer-path').html(qrIcon + "Address: " + address);
        $('#disqus_thread').show();
        $('#addressDetails').show();

        $("table").find("tr:visible:odd").addClass("odd");
        $("table").find("tr:visible:even").addClass("even");
        $("table").find("tr:visible:last").addClass("last");

        // Just for fun
        if('0xf3Db5Fa2C66B7aF3Eb0C0b782510816cbe4813b8' === address){
            $('#tab-holders span').text('Hodlers');
            $('#address-token-holders h3').text('Token Everex Hodlers');
        }

        Ethplorer.showAddressWidget(data);
        Ethplorer.showFilter(data);
    },
    showFilter: function(data){
        var activeTab = Ethplorer.getActiveTab();
        if(activeTab && data.pager && data.pager[activeTab]){
            if(activeTab != 'transfers'){
                $('#showTxChecks').hide();
            }else{
                $('#showTxChecks').show();
            }
            if(data.pager[activeTab].records > 100000 || Ethplorer.maxListSize > 100000){
                $('#filter_list').hide();
            }else{
                if(Ethplorer.showTx && data.token){
                    $('.filter-box').prepend('<style>@media screen and (max-width: 992px) { .filter-box.in-tabs {text-align: right !important; margin-top: 10px !important; height: 15px !important;} .filter-box.in-tabs .filter-form {width: 100% !important;} .filter-box.in-tabs #filter_list {width: 100% !important;} } @media screen and (max-width: 379px) {.filter-box.in-tabs {height: 40px !important;} }</style>');
                }
                $('#filter_list').show();
            }
        }
    },
    showAddressWidget: function(data){
        //console.log('testWidget = ' + testWidget);
        var oToken = Ethplorer.prepareToken(data.token);
        var address = Ethplorer.currentAddress;
        if(('undefined' !== typeof(ethplorerWidget)) && (true || !Ethplorer.isProd)){
            if(data.token || (data.isContract && data.contract.isChainy)){
                if(data.isContract && data.contract.isChainy) oToken.name = 'Chainy';
                var widgetTitle = (oToken && oToken.name) ? ($('<textarea />').html(oToken.name).text() + ' token pulse') : '';

                $('#widget-block').show();
                $('#token-price-history-grouped-widget').show();
                ethplorerWidget.init(
                    '#token-price-history-grouped-widget',
                    'tokenPriceHistoryGrouped',
                    {
                        theme: 'dark',
                        getCode: true,
                        address: address,
                        period: 730,
                        options: {title: widgetTitle}
                    }
                );
                //ethplorerWidget.loadScript("https://www.google.com/jsapi", ethplorerWidget.loadGoogleControlCharts);
                ethplorerWidget.loadGoogleControlCharts();

                /*$('#token-history-grouped-widget').show();
                ethplorerWidget.init(
                    '#token-history-grouped-widget',
                    'tokenHistoryGrouped',
                    {
                        theme: 'dark',
                        getCode: true,
                        address: address,
                        options: {title: widgetTitle, vAxis: {title: 'Token operations'}, hAxis: {title: '30 days token operations chart'}}
                    }
                );
                ethplorerWidget.loadScript("https://www.gstatic.com/charts/loader.js", ethplorerWidget.loadGoogleCharts);*/

            }else{
                if(testWidget){
                    $('#widget-block').show();
                    $('#token-price-history-grouped-widget').show();
                }else{
                    $('#widget-block').hide();
                    $('#token-price-history-grouped-widget').hide();
                }
                var opt = 
                    {
                        theme: 'dark',
                        getCode: true,
                        address: address,
                        period: 730,
                        showTx: Ethplorer.showTx
                    };
                //if(Ethplorer.Storage.get('withEth', false)) opt['withEth'] = true;
                ethplorerWidget.init(
                    '#token-price-history-grouped-widget',
                    'addressPriceHistoryGrouped',
                    opt
                );
                //ethplorerWidget.loadScript("https://www.google.com/jsapi", ethplorerWidget.loadGoogleControlCharts);
                ethplorerWidget.loadGoogleControlCharts();
            }
        }else{
            // Wait 3 seconds and retry
            /*setTimeout(function(_data){
                return function(){
                    Ethplorer.showAddressWidget(_data);
                }
            }(data), 3000);*/
        }
    },
    drawTransfers: function(address, transfersData){
        $('#filter_list').attr('disabled', false);
        for(var key in transfersData){
            Ethplorer.data[key] = transfersData[key];
        }
        var data = Ethplorer.data;
        var tableId = data.token ? 'address-token-transfers' : 'address-transfers';
        $('#' + tableId).find('.table').empty();
        if(Ethplorer.showTx && !$('#showTxEth').length){
            var showTxChecks = '<span id="showTxChecks"><span style="color: white;vertical-align:middle;"><label for="showTxEth">ETH <sup class="diff-down">new</sup></label></span> <input onClick="Ethplorer.showTransfers(this, \'eth\');" id="showTxEth" type="checkbox" ' + ((Ethplorer.showTx == 'all' || Ethplorer.showTx == 'eth') ? 'checked="checked"' : '') + ' name="showTxEth" value="1" style="vertical-align: text-bottom;margin-right:5px;">' + ' <span style="color: white;vertical-align:middle;"><label for="showTxTokens">Tokens <sup class="diff-down">new</sup></label></span> <input onClick="Ethplorer.showTransfers(this, \'tokens\');" id="showTxTokens" type="checkbox" ' + ((Ethplorer.showTx == 'all' || Ethplorer.showTx == 'tokens') ? 'checked="checked"' : '') + ' name="showTxTokens" value="1" style="vertical-align: text-bottom;margin-right:5px;"></span>';

            if(!data.token){
                $('.filter-form').prepend('<style>@media screen and (max-width: 501px) {.filter-box.out-of-tabs{height: 35px !important;}}</style>' + showTxChecks);
            }else{
                $('.filter-box').prepend('<style>.filter-box.in-tabs .filter-form{width: auto !important;} @media screen and (max-width: 501px) {.filter-box.out-of-tabs{height: 35px !important;}} @media screen and (max-width: 432px) {.filter-box.in-tabs{height: 35px !important;}}</style>' + showTxChecks);
            }
        }
        if(!data.transfers || !data.transfers.length){
            $('#' + tableId).find('.total-records').empty();
            $('#' + tableId).find('.table').append('<tr class="notFoundRow"><td>No transfers found</td></tr>');
        }else{
            for(var i=0; i<data.transfers.length; i++){
                var tx = data.transfers[i];
                var qty = parseFloat(tx.value);// Ethplorer.Utils.toBig(tx.value);
                // if(parseInt(qty.toString()) || (tx.isEth)){
                    if(tx.isEth){
                        var txToken = {address: '0x0000000000000000000000000000000000000000', name: 'Ethereum', decimals: 18, symbol: 'ETH', totalSupply: 0, price: Ethplorer.ethPrice};
                    }else{
                        var txToken = Ethplorer.prepareToken(data.token ? data.token : data.tokens[tx.contract]);
                    }
                    if(!tx.isEth){ 
                        var k = Math.pow(10, txToken.decimals);
                        if(Ethplorer.Utils.isSafari()){
                            qty = qty / k;
                        }else{
                            qty = parseFloat(Ethplorer.Utils.toBig(tx.value).div(k).toString());
                        }
                    }
                    var row = $('<tr>');
                    var tdDate = $('<td>').addClass('hide-small');
                    var tdData = $('<td>');
                    var divData = $('<div>').addClass('hash-from-to');
                    var tdQty = $('<td>').addClass('hide-small text-right');
                    var date = Ethplorer.Utils.ts2date(tx.timestamp, false);
                    var value = Ethplorer.Utils.formatNum(qty, true, txToken.decimals, 2) + ' ' + (tx.isEth ? '<i class="fab fa-ethereum"></i> ' : '') + txToken.symbol;
                    var token = Ethplorer.Utils.getEthplorerLink(tx.contract, txToken.name, false);
                    address = address.toLowerCase();
                    var from = tx.from ? ((tx.from !== address) ? Ethplorer.Utils.getEthplorerLink(tx.from) : ('<span class="same-address">' + address + '</span>')) : false;
                    var to = tx.to ? ((tx.to !== address) ? Ethplorer.Utils.getEthplorerLink(tx.to) : ('<span class="same-address">' + address + '</span>')) : false;
                    var _address = (tx.address && (tx.address === address )) ? ('<span class="same-address">' + address + '</span>') : tx.address;
                    var rowClass = '';
                    if(from && to && (tx.from === address) && (tx.to === address)){
                        rowClass = 'self';
                    }else if(from && (tx.from === address)){
                        value = '-' + value;
                        rowClass = 'outgoing';
                    }else if(to && (tx.to === address)){
                        rowClass = 'incoming';
                    }else if(tx.address === address){
                        if('burn' === tx.type){
                            rowClass = 'outgoing';
                        }else{
                            rowClass = 'incoming';
                        }
                    }
                    tdDate.html(Ethplorer.Utils.getEthplorerLink(tx.transactionHash, date, false));
                    if(!from && tx.address){
                        value = (tx.type && ('burn' === tx.type)) ? '-' + value + '<br>&#128293;&nbsp;Burn' : value + '<br>&#9874;&nbsp;Issuance';
                    }
                    var pf = parseFloat(value.replace(/\,/g,'').split(' ')[0]);
                    var usdPrice = '<br>';
                    if(pf){

                        // Fill the tx.usdPrice if tx age less 10 minutes, because of delay price update scripts
                        if (!tx.usdPrice && txToken.price && txToken.price.rate && ((new Date().getTime()/1000 - tx.timestamp ) / 60 < 10)){
                            tx.usdPrice = txToken.price.rate;
                        }

                        if(txToken.price && txToken.price.rate){
                            var usdval = Ethplorer.Utils.formatNum(Math.abs(Ethplorer.Utils.round(pf * txToken.price.rate, 2)), true, 2, true);
                            value = value + '<br><span class="transfer-usd" title="now">$&nbsp;' + usdval +
                                getHistDiffPriceString(tx.usdPrice, txToken.price.rate) + '</span>';
                        }
                        if (tx.usdPrice && Ethplorer.showHistoricalPrice){
                            var hint = 'estimated at tx date';
                            var totalHistoryPrice = Ethplorer.Utils.formatNum(Math.abs(Ethplorer.Utils.round(pf*tx.usdPrice, 2)), true, 2, true);
                            var historyPrice = Ethplorer.Utils.formatNum(Math.abs(Ethplorer.Utils.round(tx.usdPrice, 2)), true, 2, true);
                            if (historyPrice === '0.00') {
                                historyPrice = '>0.00';
                            }
                            usdPrice = '<span class="historical-price"  title="' + hint + '">~$&nbsp;'
                                + totalHistoryPrice +'<span class="mrgnl-10">@&nbsp;'+ historyPrice +'</span></span>'
                        }
                    }
                    value +=  usdPrice;
                    divData.html(
                        '<span class="show_small">Date:&nbsp;' + date + '<br></span>' +
                        (!data.token ? ('<span class="address-token-inline">Token:&nbsp;' + token + '<br></span>') : '') +
                        '<span class="show_small ' + rowClass + '">Value:&nbsp;' + value + '</span>' +
                        'Tx:&nbsp;' + Ethplorer.Utils.getEthplorerLink(tx.transactionHash) + '<br>' +
                        (from ? ('From:&nbsp;' + from + '<br>To:&nbsp;' + to) : ('Address:&nbsp;' + _address))
                    );
                    tdQty.addClass(rowClass);
                    tdQty.html(value);
                    tdData.append(divData);
                    row.append(tdDate, tdData);
                    if(!data.token){
                        var tdToken = $('<td>');
                        tdToken.addClass('address-token');
                        tdToken.html(token);
                        row.append(tdToken);
                    }
                    tdDate.find('a').attr('title', Ethplorer.Utils.ts2date(tx.timestamp, true));
                    row.append(tdQty);
                    $('#' + tableId + ' .table').append(row);
                // }
            }
            // Pager
            if(data.pager && data.pager.transfers){
                var pagination = $('<tr class="paginationFooter"><td colspan="10"></td></tr>');
                Ethplorer.drawPager(pagination.find('td'), data.pager.transfers);
                if(data.pager.transfers.total && (data.pager.transfers.total > Ethplorer.maxListSize)) Ethplorer.maxListSize = data.pager.transfers.total;
                $('#' + tableId + ' .table').append(pagination);
            }
        }
        Ethplorer.hideTableLoader();
        if((!data.pager || !data.pager.transfers) && (!data.token)){
            $('#' + tableId).hide();
            $('.filter-box').hide();
        }

        $(".table").find("tr:visible:odd").addClass("odd");
        $(".table").find("tr:visible:even").addClass("even");
        $(".table").find("tr:visible:last").addClass("last");

        $('#' + tableId).show();
    },
    showTransfers: function(switcher, type){
        var data = Ethplorer.data;
        Ethplorer.Nav.del('transfers');
        if(switcher.checked){
            type = 'all';
            Ethplorer.showTx = 'all';
        }else{
            if(type == 'eth'){
                Ethplorer.showTx = type = 'tokens';
                $('#showTxTokens').prop('checked', true);
            }else{
                Ethplorer.showTx = type = 'eth';
                $('#showTxEth').prop('checked', true);
            }
        }
        Ethplorer.gaSendEvent('userAction', 'listShowTx', type);
        Ethplorer.Storage.set('showTx', type);
        Ethplorer.Nav.set('showTx', type);
        if(!data.token && ethplorerWidget && ethplorerWidget.drawGoogleControlCharts){
            ethplorerWidget.drawGoogleControlCharts(true, {showTx: type});
        }
        //if(type != 'all') Ethplorer.Nav.set('showTx', type);
        //else Ethplorer.Nav.del('showTx');
        var tab = Ethplorer.getActiveTab();
        Ethplorer.reloadTab(tab);
    },
    drawIssuances: function(address, issuancesData){
        $('#filter_list').attr('disabled', false);
        $('#address-issuances .table').empty();
        for(var key in issuancesData){
            Ethplorer.data[key] = issuancesData[key];
        }
        var data = Ethplorer.data;
        if(!data.issuances || !data.issuances.length){
            if(!data.token) return;
            $('#address-issuances').find('.total-records').empty();
            $('#address-issuances').find('.table').append('<tr class="notFoundRow"><td>No issuances found</td></tr>');
        }else{
            var oToken = Ethplorer.prepareToken(data.token);
            for(var i=0; i<data.issuances.length; i++){
                var tx = data.issuances[i];
                // Temporary workaround
                if(tx.type == 'mint'){
                    tx.type = 'issuance';
                }
                var type = (tx.type && ('burn' === tx.type)) ? '&#128293;&nbsp;Burn' : '&#9874;&nbsp;Issuance';
                var qty = parseFloat(tx.value);
                if(!isNaN(parseInt(qty.toString()))){
                    var opClass = (tx.type.toString().toLowerCase() !== 'burn') ? 'incoming' : 'outgoing';
                    qty = qty / Math.pow(10, oToken.decimals);
                    var row = $('<tr>');
                    var tdDate = $('<td>');
                    var tdHash = $('<td>').addClass('list-field table-hash-field');
                    var tdOpType = $('<td>').addClass('text-center table-type-field ' + opClass);
                    var tdQty = $('<td>').addClass('text-right ' + opClass);
                    tdDate.html(Ethplorer.Utils.getEthplorerLink(tx.transactionHash, Ethplorer.Utils.ts2date(tx.timestamp, false), false));
                    tdDate.find('a').attr('title', Ethplorer.Utils.ts2date(tx.timestamp, true));
                    tdHash.html(Ethplorer.Utils.getEthplorerLink(tx.transactionHash));
                    tdOpType.html(type);
                    var value = (tx.type !== 'burn' ? '+' : '-') + Ethplorer.Utils.formatNum(qty, true, oToken.decimals ? oToken.decimals : 18, 2) + ((oToken.symbol) ? '&nbsp;' + oToken.symbol : '');
                    if(oToken.price && oToken.price.rate){
                        var pf = parseFloat(value.replace(/\,/g,'').split(' ')[0]);
                        if(pf){
                            pf = Ethplorer.Utils.round(pf * oToken.price.rate, 2);
                            var usdval = Ethplorer.Utils.formatNum(Math.abs(pf), true, 2, true);
                            value = value + '<br><span class="transfer-usd">$&nbsp;' + usdval + '</span>';
                        }
                    }
                    tdQty.html(value);
                    row.append(tdDate, tdHash, tdOpType, tdQty);
                    $('#address-issuances .table').append(row);
                }
            }
        }
        // Pager
        if(data.pager && data.pager.issuances && data.pager.issuances.total){
            var pagination = $('<tr class="paginationFooter"><td colspan="10"></td></tr>');
            Ethplorer.drawPager(pagination.find('td'), data.pager.issuances);
            $('#address-issuances .table').append(pagination);
        }
        Ethplorer.hideTableLoader();
        $('#address-issuances').show();
    },
    drawHolders: function(address, holdersData){
        $('#filter_list').attr('disabled', false);
        $('#address-token-holders .table').empty();
        for(var key in holdersData){
            Ethplorer.data[key] = holdersData[key];
        }
        var data = Ethplorer.data;
        if(data.token && data.holders && data.holders.length){
            var oToken = Ethplorer.prepareToken(data.token);
            var table = $('#address-token-holders').find('table');
            var totalVolume = 0;
            var totalShare = 0;
            for(var i=0; i<data.holders.length; i++){
                var holder = data.holders[i];
                totalVolume += holder['balance'];
                totalShare += holder['share'];
                var row = $('<tr>');
                var balance = holder['balance'];
                if(oToken.decimals){
                    balance = balance / Math.pow(10, oToken.decimals);
                }
                balance = Ethplorer.Utils.formatNum(balance, true, oToken.decimals, true);
                if(oToken.symbol){
                    balance = balance + ' ' + oToken.symbol;
                }else if(oToken.name){
                }
                if(oToken.price && oToken.price.rate){
                    var pf = parseFloat(balance.replace(/\,/g,'').split(' ')[0]);
                    if(pf){
                        pf = Ethplorer.Utils.round(pf * oToken.price.rate, 2);
                        var usdval = Ethplorer.Utils.formatNum(Math.abs(pf), true, 2, true);
                        balance = balance + '<br><span class="transfer-usd">$&nbsp;' + usdval + '</span>';
                    }
                }

                var address = Ethplorer.Utils.getEthplorerLink(holder['address'], holder['address'], false);
                var shareDiv = '<div><div class="holder-gauge" style="width:' + holder['share'] + '%;"></div><div class="holder-gauge-value">&nbsp;' + holder['share'] + '%</div></div>'
                var page = (data.pager && data.pager.holders) ? data.pager.holders.page : 1;
                var add = (page - 1) * Ethplorer.pageSize;
                row.append('<td>' + (add + i + 1) + '</td><td class="hide-small">' + address + '</td><td class="hide-small"></td><td class="hide-small">' + balance + '</td><td class="hide-small">' + shareDiv + '</td>');
                row.append('<td class="show_small"><div class="holder_small">' + address + '<br />' + balance + '<br />' + shareDiv + '</div></td>');
                table.append(row);
            }
            if(totalShare > 100){
                totalShare = 100;
            }
            totalShare = Ethplorer.Utils.formatNum(totalShare, true, 2, true);
            if(oToken.decimals){
                totalVolume = totalVolume / Math.pow(10, oToken.decimals);
            }
            totalVolume = Ethplorer.Utils.formatNum(totalVolume, true, oToken.decimals, true);
            var totals = 'Summary of page is '+ totalVolume + " " + oToken.symbol;
            if(data.pager && data.pager.holders){
                if(data.pager.holders.records > Ethplorer.pageSize){
                    var tname = (oToken.name != 'N/A') ? oToken.name : '';
                    totals += (', which is ' + totalShare + "% of " + oToken.name + ' total supply');
                }
            }
            $("#address-token-holders-totals").html(totals);
        }else{
            $('#address-token-holders').find('.total-records').empty();
            $('#address-token-holders').find('.table').append('<tr class="notFoundRow"><td>No holders found</td></tr>');
        }
        // Pager
        if(data.pager && data.pager.holders && data.pager.holders.total){
            var pagination = $('<tr class="paginationFooter"><td colspan="10"></td></tr>');
            Ethplorer.drawPager(pagination.find('td'), data.pager.holders);
            $('#address-token-holders .table').append(pagination);
        }
        Ethplorer.hideTableLoader();
        $('#address-token-holders').show();
    },
    drawChainy: function(address, chainyData){
        $('#filter_list').attr('disabled', false);
        $('#address-chainy-tx .table').empty();
        for(var key in chainyData){
            Ethplorer.data[key] = chainyData[key];
        }
        var data = Ethplorer.data;

        var fields = ['contract', 'contract.txsCount'];
        Ethplorer.fillValues('address', data, fields);
        if(data.chainy && data.chainy.length){
            $('#address-chainy-tx').show();
            for(var i=0; i<data.chainy.length; i++){
                var tx = data.chainy[i];
                var type = '';
                var link = '';
                if(tx.link){
                    var input = Ethplorer.Utils.hex2ascii(tx.input.substring(138).replace(/0+$/, ''));
                    var obj = false;
                    try {
                        obj = JSON.parse(input.replace(/0+$/, ''));
                    }catch(e){
//                      console.log(e.message);
//                      console.log(input);
                    }
                    if(false !== obj){
                        var chainyTypes = {
                            'R': 'Redirect',
                            'T': 'Text',
                            'H': 'Hash',
                            'L': ('undefined' !== typeof(obj['url'])) ? 'File Link' : 'File Hash',
                            'E': 'Encrypted'
                        };
                        type = chainyTypes[obj.type];
                    }
                    link = Ethplorer.Utils.hex2ascii(tx.link);
                    link = '<a href="' + link + '" target="_blank" class="external-link"><i class="fa fa-external-link-alt"></i>&nbsp;' + link + '</a>';
                }
                var row = $('<tr>');
                var tdDate = $('<td>');
                var tdHash = $('<td>').addClass('list-field table-hash-field');
                var tdOpType = $('<td>').addClass('text-center table-type-field');
                var tdLink = $('<td>');
                tdDate.html(Ethplorer.Utils.getEthplorerLink(tx.hash, Ethplorer.Utils.ts2date(tx.timestamp, false), false));
                tdDate.find('a').attr('title', Ethplorer.Utils.ts2date(tx.timestamp, true));
                tdHash.html(Ethplorer.Utils.getEthplorerLink(tx.hash));
                if(type){
                    tdOpType.html(type);
                    if('Text' === type){
                        tdOpType.append('<span class="chainy-text"></span>');
                        tdOpType.find('.chainy-text').text(obj.description.substr(0, 32));
                        tdOpType.find('.chainy-text').attr('title', obj.description);
                    }
                }else{
                    tdOpType.html('<span class="text-danger">Failed</span>');
                }
                tdLink.html(link);
                row.append(tdDate, tdHash, tdOpType, tdLink);
                $('#address-chainy-tx .table').append(row);
            }
        }else{
            $('#address-chainy-tx').find('.total-records').empty();
            $('#address-chainy-tx').find('.table').append('<tr class="notFoundRow"><td>No transactions found</td></tr>');
        }
        // Pager
        if(data.pager && data.pager.chainy){
            var pagination = $('<tr class="paginationFooter"><td colspan="10"></td></tr>');
            Ethplorer.drawPager(pagination.find('td'), data.pager.chainy);
            $('#address-chainy-tx .table').append(pagination);
        }
        Ethplorer.hideTableLoader();
        $('#address-chainy-tx').show();
    },
    drawPager: function(container, pageData){
        var currentPage     = pageData.page,
            recordsCount    = pageData.records,
            totalCount      = pageData.total;

        container.parents('.block').find('.total-records').empty();

        var pageSizeSelect = $('<SELECT class="pageSize">');
        var sizes = [10, 25, 50, 100];
        for(var i=0; i<4; i++){
            var option = $('<OPTION>');
            option.text(sizes[i]);
            option.attr('value', sizes[i]);
            if(Ethplorer.pageSize == sizes[i]){
                option.attr('selected', 'selected');
            }
            pageSizeSelect.append(option);
        }
        pageSizeSelect.change(function(_container, _pd){
            return function(){
                var ps = $(this).val();
                if(ps !== Ethplorer.pageSize){
                    Ethplorer.pageSize = ps;
                    if(Ethplorer.pageSize > 10){
                        Ethplorer.Nav.set('pageSize', ps);
                        Ethplorer.Storage.set('pageSize', ps);
                    }else{
                        Ethplorer.Nav.del('pageSize');
                        Ethplorer.Storage.set('pageSize', 10);
                    }
                    Ethplorer.reloadTab(false, true);
                }
            }
        }(container, pageData));

        var pager = $('<UL>');
        pager.addClass('pagination pagination-sm');
        setTimeout(function(_container, _count, _total){
            return function(){
                var str = Ethplorer.Utils.formatNum(_count) + ' total';
                if(_count < _total){
                    str = '<span class="filtered-totals">Filtered ' + Ethplorer.Utils.formatNum(_count) + ' records of ' + Ethplorer.Utils.formatNum(_total) + ' total</span>';
                }
                _container.parents('.block').find('.total-records').html(str);
                var filter = Ethplorer.Nav.get('filter');
                if(filter){
                    Ethplorer.gaSendEvent('userAction', 'listFilter', filter);
                    _container.parents('.table').find('a.local-link').each(function(){
                        var text = $(this).text();
                        if(0 === text.indexOf('0x')){
                            $(this).html(text.replace(new RegExp(filter, 'g'), '<span class="filer-mark">' + filter + '</span>'))
                        }
                    });
                }
            }
        }(container, recordsCount, totalCount), 100);

        container.empty();

        if(recordsCount){
            var pages = Math.ceil(recordsCount / Ethplorer.pageSize);
            var lastPage = true;
            for(var i=1; i<=pages; i++){
                if((i <= 1) || ((i <= 5) &&(currentPage <= 4)) || ((i >= (pages - 4)) &&(currentPage >= (pages - 3))) || (i >= (pages)) || ((i >= (currentPage - 1)) && (i <= (currentPage + 1)))){
                    var page = $('<LI>');
                    page.addClass('page-item');
                    var link = $('<a>');
                    link.html(i);
                    if(i === currentPage){
                        page.addClass('active');
                    }else{
                        link.attr('href', '#');
                        link.click(function(_container, _page, _pageData){
                            return function(e){
                                var tab = Ethplorer.getActiveTab();
                                Ethplorer.Nav.set(tab, _page);
                                if(_page <= 1){
                                    Ethplorer.Nav.del(tab);
                                }
                                Ethplorer.reloadTab(tab);
                                e.preventDefault();
                            };
                        }(container, i, pageData));
                    }
                    page.html(link);
                    lastPage = true;
                }else if(lastPage){
                    var page = $('<LI>');
                    page.addClass('page-item');
                    lastPage = false;
                    var splitter = $('<a>');
                    splitter.html('...');
                    page.append(splitter);
                    page.addClass('disabled');
                }else if(i < pages - 4){
                    if(i > currentPage + 1){
                        i = pages - 4;
                    }else if(i < currentPage - 1 && currentPage <= pages - 4){
                        i = currentPage - 2;
                    }else{
                        i = pages - 5;
                    }
                }
                pager.append(page);
            }
            container.append(pageSizeSelect);
            container.append(pager);
        }
    },
    prepareToken: function(oToken){
        if(!oToken){
            oToken = {address: '', name: '', decimals: 0, symbol: '', totalSupply: 0};
        }
        if(oToken.prepared){
            return oToken;
        }
        if('undefined' === typeof(oToken.totalSupply)){
            oToken.totalSupply = 0;
        }
        if('undefined' === typeof(oToken.createdAt)){
            oToken.createdAt = false;
        }
        if('undefined' === typeof(oToken.createdTx)){
            oToken.createdTx = false;
        }
        if(!oToken.name){
            oToken.name = 'N/A';
        }
        oToken.name = $('<span>').text(oToken.name).html();
        if(!oToken.owner || (oToken.owner && ('0x' === oToken.owner))){
            oToken.owner = '';
        }
        if(Ethplorer.Config.tokens && ('undefined' !== typeof(Ethplorer.Config.tokens[oToken.address]))){
            for(var property in Ethplorer.Config.tokens[oToken.address]){
                oToken[property] = Ethplorer.Config.tokens[oToken.address][property];
            }
        }
        oToken.decimals = parseFloat(Ethplorer.Utils.toBig(oToken.decimals).toString());
        oToken.totalSupply = Ethplorer.Utils.toBig(oToken.totalSupply);
        if(oToken.decimals){
            // To handle ether-like tokens with 18 decimals
            if(oToken.decimals > 20){ // Too many decimals, must be invalid value, use 0 instead
                oToken.decimals = 0;
            }
            var k = Math.pow(10, oToken.decimals);
            if(Ethplorer.Utils.isSafari()){
                oToken.totalSupply = parseFloat(oToken.totalSupply.toString()) / k;
            }else{
                oToken.totalSupply = oToken.totalSupply.div(k);
            }
            oToken.totalIn = oToken.totalIn / k;
            oToken.totalOut = oToken.totalOut / k;
        }
        if(parseFloat(oToken.totalSupply.toString()) >= 1e+18){
            if(!oToken.decimals){
                oToken.estimatedDecimals = true;
                oToken.decimals = 18;
            }
        }

        oToken.totalSupply = Ethplorer.Utils.formatNum(oToken.totalSupply, true, oToken.decimals, true);
        oToken.totalIn = Ethplorer.Utils.formatNum(oToken.totalIn, true, oToken.decimals, true);
        oToken.totalOut = Ethplorer.Utils.formatNum(oToken.totalOut, true, oToken.decimals, true);

        if(oToken.symbol){
            oToken.totalSupply = oToken.totalSupply + ' ' + oToken.symbol;
            oToken.totalIn = oToken.totalIn + ' ' + oToken.symbol;
            oToken.totalOut = oToken.totalOut + ' ' + oToken.symbol;
        }

        oToken.prepared  = true;
        return oToken;
    },
    convert: function(id, switcher){
        switcher = $(switcher);
        var pre = $('#' + id);
        var mode = pre.attr('data-mode');
        if('ascii' === mode){
            pre.text(Ethplorer.dataFields[id].hex);
            pre.attr('data-mode', 'hex');
            switcher.text('ASCII');
        }else{
            pre.text(Ethplorer.dataFields[id].ascii);
            pre.attr('data-mode', 'ascii');
            switcher.text('HEX');
        }
    },
    search: function(value, fromInput){
        value = value.replace(/^\s+/, '').replace(/\s+$/, '');
        if(value.length){
            if(Ethplorer.Utils.isAddress(value)){
                document.location.href = '/address/' + value;
                return;
            }else if(Ethplorer.Utils.isTx(value)){
                document.location.href = '/tx/' + value;
                return;
            }else if((value.length < 20) && fromInput){
                var data = {search: value};
                if(Ethplorer.debug){
                    data.debugId = Ethplorer.debugId;
                }
                $.getJSON(Ethplorer.service, data, function(data){
                    if(data.debug){
                        Ethplorer.requestDebug = data.debug;
                    }
                    var empty = !(data && data.results && data.total);
                    if(!empty){
                        document.location.href = '/address/' + data.results[0][2];
                        return;
                    }
                });
                return;
            }
        }
        if(value.length && fromInput){
            $('#search').val('');
            Ethplorer.error('Nothing found');
        }
    },
    fillValues: function(prefix, data, keys){
        for(var key in data){
            if(keys.indexOf(key) >= 0){
                if('object' == typeof(data[key])){
                    for(var sub in data[key]){
                        if(keys.indexOf(key + '.' + sub) >= 0){
                            Ethplorer.fillValue(prefix + '-' + key + '-' + sub , data[key][sub]);
                        }
                    }
                }else{
                    Ethplorer.fillValue(prefix + '-' + key, data[key]);
                }
            }
        }
    },
    fillValue: function(id, value){
        var type = $('#' + id).attr('data-type') || 'none';
        var options = $('#' + id).attr('data-options') ? $('#' + id).attr('data-options').split('|') : [];
        switch(type){
            case 'int':
            case 'float':
                value = Ethplorer.Utils.formatNum(value, 'float' === type);
                break;
            case 'price':
                if(value && value.rate){
                    var rate = value;
                    var hint = 'Updated at ' + Ethplorer.Utils.ts2date(rate.ts, true);
                    var price = rate.rate < 0.01 ? rate.rate : Ethplorer.Utils.formatNum(rate.rate, true, rate.rate < 0.1 ? 4 : 2, true);

                    value = '<span title="' + hint + '">$&nbsp;' + price + '</span><br>';

                    value = value + '<span class="diff-span">24h<span class="' + getDiffClass(rate.diff) + '">'
                        + getDiffString(rate.diff) +'</span></span>'
                    value = value + '<span class="diff-span">7d<span class="' + getDiffClass(rate.diff7d) + '">'
                        + getDiffString(rate.diff7d) +'</span></span>'
                    value = value + '<span class="diff-span">30d<span class="' + getDiffClass(rate.diff30d) + '">'
                        + getDiffString(rate.diff30d) +'</span></span>'
                }else{
                    value = '';
                }
                break;
            case 'ether':
                if(value < 0){
                    value = "N/A";
                }else{
                    value = Ethplorer.Utils.formatNum(value, true, 18, true) + '&nbsp;<i class="fab fa-ethereum"></i>&nbsp;ETH';
                }
                break;
            case 'ether-gwei':
                if(value < 0){
                    value = "N/A";
                }else{
                    var gwei = Ethplorer.Utils.toBig(value).mul(Math.pow(10, 9)).toString();
                    gwei = Ethplorer.Utils.formatNum(gwei, true, 3, true).toString();
                    if(gwei.toString().indexOf(".") > 0){
                        gwei = gwei.replace(/0*$/, '', 'g').replace(/\.$/, '', 'g');
                    }
                    value = Ethplorer.Utils.formatNum(value, true, 18, true) + '&nbsp;<i class="fab fa-ethereum"></i>&nbsp;ETH&nbsp;(' + gwei + '&nbsp;Gwei)';
                }
                break;
            case 'ether-full':
                if(value < 0){
                    value = "N/A";
                }else{
                    var res = Ethplorer.Utils.formatNum(value, true, 18, true) + '&nbsp;<i class="fab fa-ethereum"></i>&nbsp;ETH';
                    if(value){
                        var price = Ethplorer.Utils.formatNum(Ethplorer.ethPrice.rate * value, true, 2, true);
                        if(true || ('0.00' != price)){
                            var change = Ethplorer.ethPrice.diff;
                            var cls = change > 0 ? 'diff-up' : 'diff-down';
                            var diff = "";
                            // var diff = change ? (' <span class="' + cls + '">(' + Ethplorer.Utils.round(change, 2) + '%)</span>') : '';
                            res = res + '<br /><span class="tx-value-price">$ ' + price + diff + '</span>';
                        }
                    }
                    value = res;
                }
                break;
            case 'ethplorer':
                if(false !== value){
                    var text = value;
                    if(text && Ethplorer.Utils.isAddress(text)) text = Ethplorer.Utils.toChecksumAddress(value);
                    value = Ethplorer.Utils.getEthplorerLink(value, text, (options.indexOf('no-contract') < 0) ? Ethplorer.knownContracts.indexOf(value) >= 0 : false);
                }else{
                    value = "";
                }
                break;
            case 'etherscan':
                value = Ethplorer.Utils.getEtherscanLink(value, value, (options.indexOf('no-contract') < 0) ? Ethplorer.knownContracts.indexOf(value) >= 0 : false);
                break;
            case 'localdate':
                if(false !== value){
                    value = Ethplorer.Utils.ts2date(value, true);
                }else{
                    value = "";
                }
                break;
        }
        $('#' + id).html(value);
    },
    showTableLoader: function(){
        $('.filter-box').addClass('processing');
        $('.paginationFooter, .notFoundRow').parents('.table').addClass('unclickable');
        $('.total-records:visible').html('<i class="table-loading fa fa-spinner fa-spin fa-2x"></i>');
        $('.nav-tabs').addClass('unclickable');
    },
    hideTableLoader: function(){
        $('.filter-box').removeClass('processing');
        $('.table, .nav-tabs').removeClass('unclickable');
    },
    showLoader: function(){
        Ethplorer.loaderTimeout = setTimeout(function(){
            $('#loader').show();
        }, 1000);
    },
    hideLoader: function(){
        $('#loader').hide();
        if(Ethplorer.loaderTimeout){
            clearTimeout(Ethplorer.loaderTimeout);
        }
    },
    downloadData: function(address){
        console.log('Download data for ' + address);
        address = address.replace(/^\s+/, '').replace(/\s+$/, '');
        if(address.length && Ethplorer.Utils.isAddress(address)){
            var data = {data: address, csv: true};
            $.get(Ethplorer.service, data, function(data, textStatus, jqXHR){
                //console.log(data);
                Ethplorer.saveData(data, 'ethplorer.csv', 'text/csv');
                $('.export-csv').show();
                $('.export-csv-spinner').hide();
            });
        }
    },
    showQRCode: function(address){
        $("#qr-code").empty();
        $("#qr-code-address").html('<center>Ethereum address:</center><center>' + address + '</center>');
        var qrcode = new QRCode(document.getElementById("qr-code"), {
            text: address,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.L
        });
        $("#qr-code-popup").dialog('open');
    },
    Events: {
        handlers: [],
        addHandler: function(event, callback){
            if('undefined' === typeof(Ethplorer.Events.handlers[event])){
                Ethplorer.Events.handlers[event] = [];
            }
            Ethplorer.Events.handlers[event].push(callback);
            return Ethplorer.Events.handlers[event].length - 1;
        },
        delHandler: function(event, handlerIndex){
            if(('undefined' !== typeof(Ethplorer.Events.handlers[event])) && ('undefined' !== typeof(Ethplorer.Events.handlers[event][handlerIndex]))){
                delete Ethplorer.Events.handlers[event][handlerIndex];
            }
        },
        fire: function(event, data){
            if('undefined' !== typeof(Ethplorer.Events.handlers[event]) && Ethplorer.Events.handlers[event].length){
                for(var i=0; i<Ethplorer.Events.handlers[event].length; i++){
                    var res = true;
                    if('undefined' !== typeof(data)){
                        res = Ethplorer.Events.handlers[event][i](data);
                    }else{
                        res = Ethplorer.Events.handlers[event][i]();
                    }
                    if(false === res){
                        break;
                    }
                }
            }
        }
    },
    Nav: {
        data: {},
        init: function(){
            var hash = document.location.hash.replace(/^\#/, '');
            if(hash){
                aParts = hash.split('&');
                for(var i=0; i<aParts.length; i++){
                    var part = aParts[i];
                    if(part.indexOf('=') > 0){
                        var aData = part.split('=');
                        Ethplorer.Nav.data[aData[0]] = aData[1];
                    }
                }
            }
        },
        del: function(name){
            delete Ethplorer.Nav.data[name];
            Ethplorer.Nav.updateHash();
        },
        get: function(name){
            return ('undefined' !== typeof(Ethplorer.Nav.data[name])) ? Ethplorer.Nav.data[name] : false;
        },
        set: function(name, value){
            Ethplorer.Nav.data[name] = value;
            Ethplorer.Nav.updateHash();
        },
        getString: function(){
            var hash = '';
            for(var key in Ethplorer.Nav.data){
                if(hash){
                    hash += '&';
                }
                hash += (key + '=' + Ethplorer.Nav.data[key]);
            }
            return hash;
        },
        updateHash: function(){
            var hash = Ethplorer.Nav.getString();
            if(hash != document.location.hash){
                if(!hash){
                    hash = 'ready'
                }
                document.location.hash = hash;
            }
        }
    },
    // localStorage wrapper
    Storage: {
        safariInkognito: false,
        data: {},
        init: function(){
            try {
                localStorage.setItem('testItem', 1);
                localStorage.removeItem('testItem');
            }catch(e){
                Ethplorer.Storage.safariInkognito = true;
            }
        },
        get: function(key, defaultValue){
            var result = defaultValue;
            if(!Ethplorer.Storage.safariInkognito && localStorage && (null !== localStorage.getItem(key))){
                result = localStorage.getItem(key);
            }else if('undefined' !== typeof(Ethplorer.Storage.data[key])){
                result = Ethplorer.Storage.data[key];
            }
            return result;
        },
        set: function(key, value){
            if(!Ethplorer.Storage.safariInkognito){
                localStorage.setItem(key, value);
            }else{
                Ethplorer.Storage.data[key] = value;
            }
        }
    },
    Utils: {
        /**
         * Number formatter (separates thousands with comma, adds zeroes to decimal part).
         *
         * @param {int} num
         * @param {bool} withDecimals
         * @param {int} decimals
         * @param {bool} cutZeroes
         * @returns {string}
         */
        formatNum: function(num, withDecimals /* = false */, decimals /* = 2 */, cutZeroes /* = false */, noE /* = false */){
            if(!num){
                num = 0;
            }
            function padZero(s, len){
                while(s.length < len) s += '0';
                return s;
            }
            if(('object' === typeof(num)) && ('undefined' !== typeof(num.c))){
                num = parseFloat(Ethplorer.Utils.toBig(num).toString());
            }
            if('undefined' === typeof(cutZeroes)){
                cutZeroes = true;
            }
            cutZeroes = !!cutZeroes;
            withDecimals = !!withDecimals;
            decimals = ('undefined' !== typeof(decimals)) ? decimals : 2;

            if((num.toString().indexOf("e+") > 0)){
                if(noE){
                    var parts = num.toString().split('e+');
                    var ch = parts[0].replace('.', '');
                    var st = parseInt(parts[1]) - (ch.length - 1);
                    for(var i = 0; i < st; i++){
                        ch += '0';
                    }
                    num = ch.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
                }
                return num.toString();
            }
            if((num.toString().indexOf("e-") > 0) && withDecimals){
                var res = Ethplorer.Utils.toBig(num).toFixed(decimals);
                if(cutZeroes && (res.indexOf(".") > 0)){
                    res = res.replace(/0*$/, '').replace(/\.$/, '.00');
                }
                return res;
            }
            if(withDecimals){
                num = Ethplorer.Utils.round(num, decimals);
            }
            var parts = num.toString().split('.');
            var res = parts[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            var zeroCount = cutZeroes ? 2 : decimals;
            if(withDecimals && decimals){
                if(parts.length > 1){
                    res += '.';
                    var tail = parts[1].substring(0, decimals);
                    if(tail.length < zeroCount){
                        tail = padZero(tail, zeroCount);
                    }
                    res += tail;
                }else{
                    res += padZero('.', parseInt(zeroCount) + 1);
                }
            }
            if(cutZeroes && !decimals){
                res = res.split('.')[0];
            }
            return res;
        },

        /**
         * Number formatter (separates thousands with comma, adds zeroes to decimal part).
         *
         * @param {int} num
         * @param {bool} withDecimals
         * @param {int} decimals
         * @param {bool} cutZeroes
         * @returns {string}
         */
        formatNumWidget: function(num, withDecimals /* = false */, decimals /* = 2 */, cutZeroes /* = false */, withPostfix /* = false */, numLimitPostfix /* = 999999 */){
            var postfix = '';
            if(withPostfix){
                if(!numLimitPostfix) numLimitPostfix = 999999;
                if(Math.abs(num) > 999 && Math.abs(num) <= numLimitPostfix){
                    num = num / 1000;
                    postfix = ' K';
                } else if(Math.abs(num) > numLimitPostfix){
                    num = num / 1000000;
                    postfix = ' M';
                }
            }
            function padZero(s, len){
                while(s.length < len) s += '0';
                return s;
            }
            if(('object' === typeof(num)) && ('undefined' !== typeof(num.c))){
                num = parseFloat(Ethplorer.Utils.toBig(num).toString());
            }
            cutZeroes = !!cutZeroes;
            withDecimals = !!withDecimals;
//            decimals = decimals || (cutZeroes ? 0 : 2);

            if((num.toString().indexOf("e+") > 0)){
                return num.toString();
            }

            if((num.toString().indexOf("e-") > 0) && withDecimals){
                var parts = num.toString().split("e-");
                var res = parts[0].replace('.', '');
                for(var i=1; i<parseInt(parts[1]); i++){
                    res = '0' + res;
                }
                return '0.' + res;
            }

            if(withDecimals){
                num = Ethplorer.Utils.round(num, decimals);
            }
            var parts = num.toString().split('.');
            var res = parts[0].toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
            var zeroCount = cutZeroes ? 0 : decimals;
            if(withDecimals && decimals){
                if(parts.length > 1){
                    res += '.';
                    var tail = parts[1].substring(0, decimals);
                    if(tail.length < zeroCount){
                        tail = padZero(tail, zeroCount);
                    }
                    res += tail;
                }else{
                    res += padZero('.', parseInt(zeroCount) + 1);
                }
            }
            res = res.replace(/\.$/, '');
            return res + postfix;
        },
        /**
         * Parses URL path
         * @returns {string}
         */
        parsePath: function(){
            var path = document.location.pathname.split('/');
            var res = {
                cmd: '',
                arg: ''
            };
            if(path.length > 1){
                res.cmd = path[1];
                if(path.length > 2){
                    res.arg = path[2];
                }
            }
            return res;
        },
        /**
         *
         * @returns {String}
         */
        getEtherscanAddress: function(){
            return 'https://' + (Ethplorer.Config.testnet ? 'testnet.' : '') + 'etherscan.io/';
        },
        isAddress: function(address){
            return /^0x[0-9a-f]{40}$/.test(address.toString().toLowerCase());
        },
        isTx: function(hash){
            return /^0x[0-9a-f]{64}$/.test(hash.toString().toLowerCase());
        },
        getEtherscanLink: function(data, text, isContract){
            text = text || data;
            text = $('<span>').text(text).html();
            if(!/^0x/.test(data)){
                return text;
            }
            var res = text;
            if(isContract){
                res = 'Contract ' + res;
            }
            return res;
        },
        getEthplorerLink: function(data, text, isContract){
            text = text || data;
            if(!/^0x/.test(data)){
                return text;
            }
            var isTx = Ethplorer.Utils.isTx(data);
            //if(!isTx) text = Ethplorer.Utils.toChecksumAddress(text);
            if((text.indexOf('<') >= 0) || (text.indexOf('>') >= 0)){
                text = $('<span>').text(text).html();
            }
            var res = '<a href="/';
            res += (isTx ? 'tx' : 'address');
            res += ('/' + data + '"  class="local-link">' + text + '</a>');
            if(isContract){
                res = 'Contract ' + res;
            }
            return res;
        },
        // Date with fixed GMT to local date
        ts2date: function(ts, withGMT){
            withGMT = 'undefined' !== typeof(withGMT) ? withGMT : true;
            ts *= 1000;
            function padZero(s){
                return (s < 10) ? '0' + s : s.toString();
            }
            var res = '';
            var dt = new Date(ts);
            res += (dt.getFullYear() + '-' + padZero((dt.getMonth() + 1)) + '-' + padZero(dt.getDate()));
            res += ' ';
            res += (padZero(dt.getHours()) + ':' + padZero(dt.getMinutes()) + ':' + padZero(dt.getSeconds()));
            if(withGMT){
                res += (' (' + Ethplorer.Utils.getTZOffset() + ')');
            }
            return res;
        },
        getTZOffset: function(){
            var offset = -Math.round(new Date().getTimezoneOffset() / 60);
            return 'GMT' + (offset > 0 ? '+' : '-') + offset;
        },
        hideEmptyFields: function(){
            $('.list-field').parents('TR').show();
            $('.list-field:empty').parents('TR').hide();
            // Hide zero decimals
            /*
            var decimals = parseInt($('#address-token-decimals').text());
            if(!decimals){
                $('#address-token-decimals').parent().hide();
            }
            */
        },
        ascii2hex: function(text){
            var res = [];
            for (var i=0; i<text.length; i++){
                var hex = Number(text.charCodeAt(i)).toString(16);
                res.push(hex);
            }
            return res.join('');
        },
        hex2ascii: function(data){
            var res = '';
            try {
                res = data.match(/.{2}/g).map(function(v){
                    return String.fromCharCode(parseInt(v, 16));
                }).join('');
            } catch(e) {}
            return res;
        },
        hex2utf: function(data){
            var res = '';
            try {
                var uri = data.toLowerCase().replace(/[0-9a-f]{2}/g, '%$&');
                res = decodeURIComponent(uri);
            } catch(e) {}
            return res;
        },
        parseJData: function(hex){
            var str = Ethplorer.Utils.hex2ascii(hex.slice(8)).replace('{{', '{').replace(/^[^{]+/, '');
            var res = false;
            var i1 = str.indexOf('{');
            var i2 = str.lastIndexOf('}');
            if(i1 >= 0 && i2 >= 0 && i1 < i2){
                var jstr = str.substr(i1, i2 - i1 + 1);
                try {
                    res = JSON.parse(jstr);
                }catch(e){}
                if(res){
                    var rrr = Ethplorer.Utils.ascii2hex(jstr);
                    rrr = Ethplorer.Utils.hex2utf(rrr);
                    res = JSON.parse(rrr);
                }
            }
            var fullStr = Ethplorer.Utils.hex2ascii(hex);
            if(!res && (fullStr.indexOf("Issuance") > 0)){
                res = {description: fullStr.substr(fullStr.indexOf("Issuance")).replace(/\\n/g, "\n").replace(/\\u0000/g, "")};
            }
            return res;
        },
        toBig: function(obj){
            var res = new BigNumber(0);
            if (obj && 'string' === typeof(obj)) {
                obj = obj.replace(/,/g, '');
            }
            if(obj && 'undefined' !== typeof(obj.c)){
                res.c = obj.c;
                res.e = obj.e;
                res.s = obj.s;
            }else{
                res = new BigNumber(obj);
            }
            return res;
        },
        isSafari: function(){
            var isIphone = /(iPhone)/i.test(navigator.userAgent);
            var isSafari = !!navigator.userAgent.match(/Version\/[\d\.]+.*Safari/);
            return isIphone || isSafari;
        },
        round: function(val, decimals){
            decimals = decimals ? parseInt(decimals) : 0;
            var parts = val.toString().split('.');
            if(parts.length > 1){
                if(parts[1].length > decimals){
                    var k = decimals ? Math.pow(10, decimals) : 1;
                    return Math.round(val * k) / k;
                }
            }
            return val;
        },
        floor: function(val, decimals){
            decimals = decimals ? parseInt(decimals) : 0;
            var k = decimals ? Math.pow(10, decimals) : 1;

            return Math.floor(val * k) / k;
        },
        pdiff: function(a, b){
            var res = 100;
            if(a !== b){
                if(a && b){
                    res = (a / b) * 100 - 100;
                }else{
                    res *= ((a - b) < 0) ? -1 : 1;
                }
            }else{
                res = 0;
            }
            return res;
        },
        isHexPrefixed: function(str){
            return str.slice(0, 2) === '0x';
        },
        stripHexPrefix: function(str){
            if(typeof str !== 'string'){
                return str;
            }
            return Ethplorer.Utils.isHexPrefixed(str) ? str.slice(2) : str;
        },
        toChecksumAddress: function(address){
            address = Ethplorer.Utils.stripHexPrefix(address).toLowerCase();
            var hash = keccak_256(address).toString('hex');
            var ret = '0x';

            for(var i = 0; i < address.length; i++){
                if(parseInt(hash[i], 16) >= 8){
                    ret += address[i].toUpperCase();
                }else{
                    ret += address[i];
                }
            }

            return ret;
        },
        /**
         * NOTE: should run once
         * work with .scrollwrapper class
         * .srollable > .scrollwrapper > <scrollable content>
         *
         */
        initScrollable: function () {
            function checkPosition(el){
                var $el = $(el);
                var $child = $el.children();

                $el.removeClass('hide-bottom-gr');

                if ($child.outerHeight(true) < $el.outerHeight(true) || $child.outerHeight(true) - $el.outerHeight(true) + $child.position().top === 0){
                    //bottom
                    $el.addClass('hide-bottom-gr')
                }

                // expand-btn now only for Token Balances block
                // to extend functionality need to update storage keys depends on block
                var $expand = $el.closest('.block').find('.expand-btn');
                if ($expand.length && $el.outerHeight(true) < $el.children().outerHeight(true)) {
                    $expand.show();
                    var text = Ethplorer.Storage.get('expand-address-token-balances', 'expand');
                    $expand
                        .html(text + (text === 'collapse' ? '&uarr;': '&darr;'))
                        .toggleClass('shift-up', text.indexOf('expand') !== -1)
                        .parent()
                        .siblings('.scrollable')
                        .toggleClass('expanded', text.indexOf('collapse') !== -1)
                    $(document).on('click', '.expand-btn', function(e){
                        var $btn = $(e.target);
                        var $scrollable = $btn.parent().siblings('.scrollable');
                        var bool = $btn.text().indexOf('expand') !== -1;
                        $scrollable.toggleClass('expanded', bool);
                        text = bool ? 'collapse' : 'expand';
                        $btn
                            .toggleClass('shift-up', text === 'expand')
                            .html(text + (bool ? '&uarr;': '&darr;'))
                        Ethplorer.Storage.set('expand-address-token-balances', text);
                        if (!bool){
                            $('#address-balances-total')[0].scrollIntoView({behavior: "instant", block: "start"})
                        }
                    })
                }
            }
            $('.scrollwrapper').one("DOMSubtreeModified", function(event){
                setTimeout(() => {
                    checkPosition(event.target.parentElement)
                },100)
            });

        }
    },
    enableHistoricalPrice: function(bool){
        bool = bool === undefined;
        sessionStorage.setItem("enableHistoricalPrice", bool);
        location.reload();
    },
    gaSendEvent: function(category, action, label){
        if(Ethplorer.Config.ga && ('undefined' !== typeof(ga))){
            ga('send', 'event', category, action, label);
        }
    }
};

function getDiffClass(value) {
    if (value === 0 || 'undefined' === typeof value) {
        return 'diff-zero'
    }
    return value > 0 ? 'diff-up' : 'diff-down';
}

function getDiffString(diff){
    if ('undefined' === typeof diff) {
        return '--';
    }
    var str = ''; //(diff > 0 ? '+' : '');
    str +=  Ethplorer.Utils.formatNumWidget(diff, true, 2, true, true) + '%';
    return str;
}
function getHistDiffPriceString(histPrice, currPrice){
    var diffTag = '';
    if(histPrice && Ethplorer.showHistoricalPrice){
        var diff = Ethplorer.Utils.round(Ethplorer.Utils.pdiff(currPrice, histPrice), 2);
        var cls = getDiffClass(diff);
        diff = Ethplorer.Utils.formatNum(diff, true, 2, true, true);
        diffTag = '<span class="' + cls + '">(' + diff + '%)</span>'
    }
    return diffTag;
}

function getHistUsdPriceString(histPrice, valFloat){
    var usdPrice = '';
    if(histPrice && Ethplorer.showHistoricalPrice && valFloat){
        var hint = 'estimated at tx date';
        // var historyPrice = Ethplorer.Utils.formatNum(histPrice, true, 2, true, true);
        var totalHistoryPrice = Ethplorer.Utils.formatNum(histPrice * valFloat, true, 2, true, true);

        usdPrice = '<span title="' + hint + '">~$&nbsp;' + totalHistoryPrice +'<span class="mrgnl-10">@&nbsp;'+ histPrice +'</span></span>'
    }
    return usdPrice;
}