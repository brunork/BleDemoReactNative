import React, { useState, useEffect } from "react";
import BleManager from "react-native-ble-manager";
import {
    SafeAreaView,
    StyleSheet,
    ScrollView,
    View,
    Text,
    StatusBar,
    NativeModules,
    NativeEventEmitter,
    Platform,
    PermissionsAndroid,
    FlatList,
    TouchableHighlight,
    TouchableOpacity,
} from "react-native";

// Styles
import Colors from "./theme/Colors";
import aesjs from "aes-js";
import { btoa, concatArrayAndCommand, base64ToArrayBuffer, arrayToBase64 } from './utilities/helperFunctions';

// Native Modules
const BleManagerModule = NativeModules.BleManager;
const bleManagerEmitter = new NativeEventEmitter(BleManagerModule);

const App = () => {
    const [isScanning, setIsScanning] = useState(false);
    const peripherals = new Map();
    const [list, setList] = useState([]);
    // const blekey = new Uint8Array([245, 210, 41, 135, 101, 10, 29, 130, 5, 171, 130, 190, 185, 56, 89, 207]);
    const blekey = [ 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16 ];
    const iv = [ 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34,35, 36 ];

    const startScan = () => {
        if (!isScanning) {
            BleManager.scan([], 3, true)
                .then((results) => {
                    console.log("Scanning...");
                    setIsScanning(true);
                })
                .catch((err) => {
                    console.error(err);
                });
        }
    };

    const handleStopScan = () => {
        console.log("Scan is stopped");
        setIsScanning(false);
    };

    const handleDisconnectedPeripheral = (data) => {
        let peripheral = peripherals.get(data.peripheral);
        if (peripheral) {
            peripheral.connected = false;
            peripherals.set(peripheral.id, peripheral);
            setList(Array.from(peripherals.values()));
        }
        console.log("Disconnected from " + data.peripheral);
    };

    const handleUpdateValueForCharacteristic = (data) => {
        console.log(
            "Received data from " +
            data.peripheral +
            " characteristic " +
            data.characteristic,
            data.value
        );
    };

    const retrieveConnected = () => {
        BleManager.getConnectedPeripherals([]).then((results) => {
            if (results.length == 0) {
                console.log("No connected peripherals");
            }
            for (let i = 0; i < results.length; i++) {
                let peripheral = results[i];
                peripheral.connected = true;
                peripherals.set(peripheral.id, peripheral);
                setList(Array.from(peripherals.values()));
            }
        });
    };

    const handleDiscoverPeripheral = (peripheral) => {
        console.log("Got ble peripheral", peripheral);
        if (!peripheral.name) {
            peripheral.name = "NO NAME";
        }
        peripherals.set(peripheral.id, peripheral);
        setList(Array.from(peripherals.values()));
    };

    const authenticateDevice = async (service, characteristic, connectionKey) => {
        try {
        //   let receivedKey = characteristic.value.substring(4);
          let concatKeyInBytes = base64ToArrayBuffer(connectionKey);
          let encryptor = new aesjs.ModeOfOperation.ofb(blekey, iv);;
          let encryptedKeyInBytes = encryptor.encrypt(concatKeyInBytes);
          let finalValue = concatArrayAndCommand([3, 0], encryptedKeyInBytes);

          console.log(finalValue, arrayToBase64(finalValue));
          BleManager.writeWithoutResponse(service, characteristic, arrayToBase64(finalValue))
            .catch(error => {
              alert("Sending encrypted key back to device failed", error);
            })
        } catch (error) {
          console.log('Failed to authenticate device', error);
        }
      }

    const pressPeripheral = async (peripheral) => {
        console.log("pressPeripheral");
        BleManager.connect(peripheral.id)
            .then(() => {
                console.log("Connected to " + peripheral.id);
                alert(JSON.stringify("Connected to " + peripheral.id))
            })
            .then(() => {
                BleManager.retrieveServices(peripheral.id)
                    .then((peripheralInfo) => {
                        console.log('peripheralInfo: ', peripheralInfo)
                        let service = peripheralInfo.characteristics[11].service;
                        let bakeCharacteristic =
                            peripheralInfo.characteristics[11].characteristic;
                        let crustCharacteristic =
                            peripheralInfo.characteristics[11].characteristic;

                    BleManager.startNotification(peripheralInfo.id, service, bakeCharacteristic)
                        .then(async () => {
                            let connectionKey = concatArrayAndCommand([1, 95], blekey);

                            console.log('Started notification channel')
                            authenticateDevice(service, crustCharacteristic, connectionKey);
                        })
                    })
                    .catch(error => {
                        console.log("Error: ", error);
                    })
            })
            .catch((error) => {
                console.log("Connection error", error);
            });
    };

    useEffect(() => {
        BleManager.start({ showAlert: false });

        bleManagerEmitter.addListener(
            "BleManagerDiscoverPeripheral",
            handleDiscoverPeripheral
        );
        bleManagerEmitter.addListener("BleManagerStopScan", handleStopScan);
        bleManagerEmitter.addListener(
            "BleManagerDisconnectPeripheral",
            handleDisconnectedPeripheral
        );
        bleManagerEmitter.addListener(
            "BleManagerDidUpdateValueForCharacteristic",
            ({ value, peripheral, characteristic, service }) => {
                // Convert bytes array to string
                const data = bytesToString(value);
                console.log(`Recieved ${data} for characteristic ${characteristic}`);
            }
        );

        bleManagerEmitter.addListener(
            "BleManagerDidUpdateValueForCharacteristic",
            handleUpdateValueForCharacteristic
        );

        if (Platform.OS === "android" && Platform.Version >= 23) {
            PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
            ).then((result) => {
                if (result) {
                    console.log("Permission is OK");
                } else {
                    PermissionsAndroid.request(
                        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
                    ).then((result) => {
                        if (result) {
                            console.log("User accept");
                        } else {
                            console.log("User refuse");
                        }
                    });
                }
            });
        }

        return () => {
            console.log("unmount");
            bleManagerEmitter.removeListener(
                "BleManagerDiscoverPeripheral",
                handleDiscoverPeripheral
            );
            bleManagerEmitter.removeListener("BleManagerStopScan", handleStopScan);
            bleManagerEmitter.removeListener(
                "BleManagerDisconnectPeripheral",
                handleDisconnectedPeripheral
            );
            bleManagerEmitter.removeListener(
                "BleManagerDidUpdateValueForCharacteristic",
                handleUpdateValueForCharacteristic
            );
        };
    }, []);

    const renderItem = (item) => {
        let backgroundItemColor = item.connected ? Colors.green : Colors.grey;
        return (
            <TouchableHighlight onPress={() => pressPeripheral(item)}>
                <View style={[styles.row, { backgroundColor: backgroundItemColor }]}>
                    <Text
                        style={{
                            fontSize: 12,
                            textAlign: "center",
                            color: Colors.darkBlue,
                            padding: 10,
                        }}
                    >
                        {item.name}
                    </Text>
                    <Text
                        style={{
                            fontSize: 10,
                            textAlign: "center",
                            color: Colors.darkBlue,
                            padding: 2,
                        }}
                    >
                        RSSI: {item.rssi}
                    </Text>
                    <Text
                        style={{
                            fontSize: 8,
                            textAlign: "center",
                            color: Colors.darkBlue,
                            padding: 2,
                            paddingBottom: 20,
                        }}
                    >
                        {item.id}
                    </Text>
                </View>
            </TouchableHighlight>
        );
    };

    return (
        <>
            <StatusBar barStyle="dark-content" />
            <SafeAreaView>
                <ScrollView
                    contentInsetAdjustmentBehavior="automatic"
                    style={styles.scrollView}
                >
                    {global.HermesInternal == null ? null : (
                        <View style={styles.engine}>
                            <Text style={styles.footer}>Engine: Hermes</Text>
                        </View>
                    )}
                    <View style={styles.body}>
                        <View style={{ margin: 10 }}>
                            <TouchableOpacity
                                style={styles.buttonWrapper}
                                title={"Scan Bluetooth (" + (isScanning ? "on" : "off") + ")"}
                                onPress={() => startScan()}
                            >
                                <Text style={styles.buttonText}>
                                    {"Scan Bluetooth (" + (isScanning ? "on" : "off") + ")"}
                                </Text>
                            </TouchableOpacity>
                        </View>

                        <View style={{ margin: 10 }}>
                            <TouchableOpacity
                                style={styles.buttonWrapper}
                                title="Retrieve connected peripherals"
                                onPress={() => retrieveConnected()}
                            >
                                <Text style={styles.buttonText}>
                                    Retrieve connected peripherals
                                </Text>
                            </TouchableOpacity>
                        </View>
                        {
                            list.length == 0 && (
                                <View style={{ flex: 1, margin: 20 }}>
                                    <Text style={{ textAlign: "center" }}>No peripherals</Text>
                                </View>
                            )
                        }
                    </View>
                </ScrollView>
                <FlatList
                    data={list}
                    renderItem={({ item }) => renderItem(item)}
                    keyExtractor={(item) => item.id}
                />
            </SafeAreaView>
        </>
    );
};

const styles = StyleSheet.create({
    row: {
        marginHorizontal: 10,
        marginVertical: 5,
        borderRadius: 10
    },
    scrollView: {
        backgroundColor: Colors.white,
    },
    engine: {
        position: "absolute",
        right: 0,
    },
    body: {
        backgroundColor: Colors.white,
    },
    sectionContainer: {
        marginTop: 32,
        paddingHorizontal: 24,
    },
    sectionTitle: {
        fontSize: 24,
        fontWeight: "600",
        color: Colors.darkBlue,
    },
    sectionDescription: {
        marginTop: 8,
        fontSize: 18,
        fontWeight: "400",
        color: Colors.darkBlue,
    },
    highlight: {
        fontWeight: "700",
    },
    footer: {
        color: Colors.darkBlue,
        fontSize: 12,
        fontWeight: "600",
        padding: 4,
        paddingRight: 12,
        textAlign: "right",
    },
    buttonWrapper: {
        backgroundColor: Colors.darkBlue,
        padding: 10,
        justifyContent: "center",
        alignItems: "center",
    },
    buttonText: {
        color: Colors.white,
        textTransform: "uppercase",
    },
});

export default App;
