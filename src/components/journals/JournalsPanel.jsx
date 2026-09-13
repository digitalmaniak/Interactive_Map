"use client";

import AddMemoryForm from "./AddMemoryForm";
import JournalList from "./JournalList";
import ClusterList from "./ClusterList";
import PinDetail from "./PinDetail";

/**
 * Right-side Travel Journals panel: shell chrome + mode router.
 * Modes: add entry | pin detail | cluster list | chronological list.
 * State and callbacks owned by MapCanvas; this component only switches views.
 */
export default function JournalsPanel({
  activeTab,
  isAddingEntry,
  activePin,
  clusterPins,
  pins,
  // Add memory
  newPinName,
  setNewPinName,
  newPinCity,
  setNewPinCity,
  newPinStartDate,
  setNewPinStartDate,
  newPinEndDate,
  setNewPinEndDate,
  clickedCoords,
  setClickedCoords,
  newPinDetails,
  setNewPinDetails,
  handleAddPin,
  closeJournalPanel,
  // Pin detail
  isConfirmingDelete,
  setIsConfirmingDelete,
  isEditingPin,
  editPin,
  setEditPin,
  startEditingPin,
  handleUpdatePin,
  setIsEditingPin,
  editingLogId,
  editLog,
  setEditLog,
  startEditingLog,
  handleUpdateLog,
  setEditingLogId,
  handleDeleteLog,
  isAddingLog,
  setIsAddingLog,
  newLogTitle,
  setNewLogTitle,
  newLogContent,
  setNewLogContent,
  newLogCategory,
  setNewLogCategory,
  handleAddLog,
  handleRemovePin,
  onBackFromPin,
  // Lists
  onSelectPin,
  onBackFromCluster,
}) {
  return (
    <div className="glass-base" style={{
      position: "absolute",
      top: "0px",
      right: "0px",
      width: "350px",
      bottom: "0px",
      display: "flex",
      flexDirection: "column",
      padding: "1rem",
      zIndex: 100,
      overflow: "hidden",
      gap: "1rem",
      backdropFilter: "blur(20px)",
      borderRadius: "0px",
      borderRight: "none",
      borderBottom: "none",
      borderTop: "none",
      background: "rgba(255, 255, 255, 0.85)",
      boxShadow: "-12px 0 40px rgba(0,0,0,0.18)",
      transform: activeTab === "Travel Journals" ? "translateX(0)" : "translateX(100%)",
      transition: "transform 0.35s cubic-bezier(0.4, 0, 0.2, 1)",
      pointerEvents: activeTab === "Travel Journals" ? "auto" : "none"
    }}>
      {isAddingEntry ? (
        <AddMemoryForm
          newPinName={newPinName}
          setNewPinName={setNewPinName}
          newPinCity={newPinCity}
          setNewPinCity={setNewPinCity}
          newPinStartDate={newPinStartDate}
          setNewPinStartDate={setNewPinStartDate}
          newPinEndDate={newPinEndDate}
          setNewPinEndDate={setNewPinEndDate}
          clickedCoords={clickedCoords}
          setClickedCoords={setClickedCoords}
          newPinDetails={newPinDetails}
          setNewPinDetails={setNewPinDetails}
          onAddPin={handleAddPin}
          onCancel={closeJournalPanel}
        />
      ) : activePin ? (
        <PinDetail
          activePin={activePin}
          isConfirmingDelete={isConfirmingDelete}
          setIsConfirmingDelete={setIsConfirmingDelete}
          isEditingPin={isEditingPin}
          editPin={editPin}
          setEditPin={setEditPin}
          startEditingPin={startEditingPin}
          handleUpdatePin={handleUpdatePin}
          setIsEditingPin={setIsEditingPin}
          editingLogId={editingLogId}
          editLog={editLog}
          setEditLog={setEditLog}
          startEditingLog={startEditingLog}
          handleUpdateLog={handleUpdateLog}
          setEditingLogId={setEditingLogId}
          handleDeleteLog={handleDeleteLog}
          isAddingLog={isAddingLog}
          setIsAddingLog={setIsAddingLog}
          newLogTitle={newLogTitle}
          setNewLogTitle={setNewLogTitle}
          newLogContent={newLogContent}
          setNewLogContent={setNewLogContent}
          newLogCategory={newLogCategory}
          setNewLogCategory={setNewLogCategory}
          handleAddLog={handleAddLog}
          handleRemovePin={handleRemovePin}
          onBack={onBackFromPin}
        />
      ) : clusterPins ? (
        <ClusterList
          clusterPins={clusterPins}
          onSelectPin={onSelectPin}
          onBack={onBackFromCluster}
        />
      ) : (
        <JournalList
          pins={pins}
          onSelectPin={onSelectPin}
        />
      )}
    </div>
  );
}
