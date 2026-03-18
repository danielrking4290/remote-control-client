import { StyleSheet } from "react-native";

export const baseStyles = StyleSheet.create({
    safeArea: {
        height: "100%",
        backgroundColor: "#090909"
    },
    canvas: {
        flex: 1,
        backgroundColor: "#303030"
    },
    headingContainer: {
        flexDirection: "row",
        alignItems: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#404040",
        backgroundColor: "#303030",
        height: 70
    },
    bodyText: {
        color: "#ffffff",
        fontSize: 14,
        fontFamily: "Roboto"
    },
    subheadingText: {
        color: "#ffffff",
        fontSize: 18,
        fontFamily: "Roboto",
        fontWeight: "bold"
    },
    headingText: {
        color: "#ffffff",
        fontSize: 20,
        fontFamily: "Roboto",
        fontWeight: "bold"
    },
    iconButton: {
        padding: 10,
        minWidth: 44,
    },
    textButton: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        padding: 15,
        borderRadius: 8,
        backgroundColor: "#404040",
        height: 70
    },
    textButtonSelected: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 8,
        backgroundColor: "#707070"
    },
    buttonLabelContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "45%"
    },
    buttonLabelIconContainer: {
        width: 32,
        height: 32,
        resizeMode: "contain",
        flex: 3,
        alignItems: "center",
        justifyContent: "center"
    },
    buttonLabelTextContainer: {
        flex: 8
    },
    scrollViewContentContainer: {
        padding: 15,
        backgroundColor: "#303030",
        gap: 5
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.9)",
        justifyContent: "flex-end",
    },
    modalContent: {
        backgroundColor: "#202020",
        height: "90%",
        borderTopLeftRadius: 16,
        borderTopRightRadius: 16,
        paddingLeft: 15,
        paddingRight: 15,
    },
    modalHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "flex-start",
        gap: 10,
        padding: 10,
        height: 70
    },
    modalFooter: {
        height: 70,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#202020"
    },
    menuItemLabel: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        backgroundColor: "#404040",
        padding: 15,
        borderRadius: 8,
        height: 70
    },
    menuItemIcon: {
        width: 32,
        height: 32,
        resizeMode: "contain"
    },
    actionIcon: {
        width: 40,
        height: 40,
        resizeMode: "contain"
    },
    mediaIcon: {
        width: 22,
        height: 22,
        resizeMode: "contain"
    },
    dismissModalButton: {
        justifyContent: "center",
        alignItems: "center",
        height: "100%",
        width: "100%"
    },
    headingBackButton: {
        padding: 10,
        minWidth: 60,
        alignItems: "center",
        justifyContent: "center"

    }
});