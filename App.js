import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, SafeAreaView, TouchableOpacity, ScrollView, TextInput, Modal, Image, Dimensions, KeyboardAvoidingView, Platform, Alert, ActivityIndicator } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { createClient } from '@supabase/supabase-js';

// --- CLOUD INFRASTRUCTURE LINK ---
const SUPABASE_URL = 'https://dgeewroyceocxsedllxl.supabase.co'; 
const SUPABASE_ANON_KEY = 'https://dd6c6403-8584-42a5-a4da-99aae0dafa13-00-hj3bqmi0t6iv.janeway.replit.dev';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default function App() {
  const [screenWidth, setScreenWidth] = useState(Dimensions.get('window').width);

  useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setScreenWidth(window.width);
    });
    return () => subscription?.remove();
  }, []);

  const isDesktop = screenWidth >= 768;

  // --- SYSTEM APPLICATION ARCHITECTURE STATES ---
  const [session, setSession] = useState(null);
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [isSignUpMode, setIsSignUpMode] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('Logs'); 
  const [currentView, setCurrentView] = useState('Feed'); 
  const [isComposeVisible, setIsComposeVisible] = useState(false);
  const [isEditProfileVisible, setIsEditProfileVisible] = useState(false);
  const [feedLoading, setFeedLoading] = useState(false);

  // --- INTERACTION & FEED BUFFER DATA STATES ---
  const [isCommentModalVisible, setIsCommentModalVisible] = useState(false);
  const [activeCommentLogId, setActiveCommentLogId] = useState(null);
  const [newCommentText, setNewCommentText] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [followedUsers, setFollowedUsers] = useState([]);
  const [newPostText, setNewPostText] = useState('');
  const [attachedMedia, setAttachedMedia] = useState(null); 
  const [logs, setLogs] = useState([]);

  const [userProfile, setUserProfile] = useState({
    name: 'Explorer',
    handle: '@user',
    bio: 'Mapping structural systems and documenting route networks.',
    avatar: '', 
    followingCount: 0
  });
  
  const [inputName, setInputName] = useState('');
  const [inputBio, setInputBio] = useState('');

  // --- CORE CHAT LOG ENGINE ---
  const [messages, setMessages] = useState([
    { 
      id: '1', 
      user: 'System Monitor', 
      handle: '@monitor', 
      avatar: '', 
      snippet: 'Welcome to the system logging network.', 
      time: '1m', 
      unread: true, 
      chatHistory: [
        { sender: 'them', text: 'Welcome to TO PLACES logs. System communication online.' }
      ]
    }
  ]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [chatInputText, setChatInputText] = useState('');

  // --- LIFECYCLE SYNC OPERATIONS ---
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchUserProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) {
      fetchCloudTimeline();
    }
  }, [session]);

  const fetchUserProfile = async (userId) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    if (data) {
      setUserProfile({
        name: data.full_name || 'EXPLORER',
        handle: `@${data.username || 'user'}`,
        bio: data.bio || '',
        avatar: data.avatar_url || '',
        followingCount: 0
      });
      setInputName(data.full_name || '');
      setInputBio(data.bio || '');
    }
  };

  const fetchCloudTimeline = async () => {
    setFeedLoading(true);
    const { data } = await supabase
      .from('posts')
      .select('id, content, media_url, created_at, user_id, profiles ( id, full_name, username, avatar_url )')
      .order('created_at', { ascending: false });

    if (data) {
      setLogs(data.map(post => ({
        id: post.id,
        userId: post.user_id,
        user: post.profiles?.full_name || 'EXPLORER',
        handle: `@${post.profiles?.username || 'user'}`,
        avatar: post.profiles?.avatar_url || '',
        time: 'Live',
        content: post.content,
        media: post.media_url,
        likes: 0,
        liked: false,
        comments: []
      })));
    }
    setFeedLoading(false);
  };

  const handleAuthentication = async () => {
    if (!authEmail || !authPassword) {
      Alert.alert('Error', 'Fields cannot be blank.');
      return;
    }
    setAuthLoading(true);
    if (isSignUpMode) {
      const { error } = await supabase.auth.signUp({ email: authEmail, password: authPassword });
      if (error) Alert.alert('Registration Failed', error.message);
      else Alert.alert('Success', 'Account created successfully.');
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: authEmail, password: authPassword });
      if (error) Alert.alert('Login Failed', error.message);
    }
    setAuthLoading(false);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setCurrentView('Feed');
  };

  const handlePublishPost = async () => {
    if (newPostText.trim() === '' && !attachedMedia) return;
    const { error } = await supabase
      .from('posts')
      .insert([{ user_id: session.user.id, content: newPostText, media_url: attachedMedia }]);

    if (error) {
      Alert.alert('Post Error', error.message);
    } else {
      setNewPostText('');
      setAttachedMedia(null);
      setIsComposeVisible(false);
      fetchCloudTimeline();
    }
  };

  const handleDeletePost = async (postId) => {
    const { error } = await supabase
      .from('posts')
      .delete()
      .eq('id', postId)
      .eq('user_id', session.user.id);

    if (error) {
      Alert.alert('Deletion Terminated', error.message);
    } else {
      fetchCloudTimeline();
    }
  };

  const saveProfileChanges = async () => {
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: inputName, bio: inputBio })
      .eq('id', session.user.id);

    if (!error) {
      setUserProfile(prev => ({ ...prev, name: inputName, bio: inputBio }));
      setIsEditProfileVisible(false);
    } else {
      Alert.alert('Error', 'Update failed.');
    }
  };

  const renderAvatar = (avatarUrl, name, sizeStyle = styles.avatarMini) => {
    if (avatarUrl && avatarUrl.trim() !== '') {
      return <Image source={{ uri: avatarUrl }} style={sizeStyle} />;
    }
    const letter = name ? name.charAt(0).toUpperCase() : '?';
    return (
      <View style={[sizeStyle, styles.avatarFallback]}>
        <Text style={styles.avatarFallbackText}>{letter}</Text>
      </View>
    );
  };

  const pickImage = async () => {
    const permissions = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissions.granted) return;
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (!result.canceled) setAttachedMedia(result.assets[0].uri);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ flex: 1, flexDirection: isDesktop ? 'row' : 'column' }}>
        
        {/* DESKTOP SIDEBAR NAV BAR */}
        {isDesktop && (
          <View style={styles.sidebar}>
            <Text style={styles.logo}>TO <Text style={{color: '#FFD700'}}>PLACES</Text></Text>
            <View style={{ marginTop: 40, width: '100%' }}>
              <TouchableOpacity style={[styles.sideLink, currentView === 'Feed' && styles.sideLinkActive]} onPress={() => setCurrentView('Feed')}><Text style={styles.sideLinkText}>Feed</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sideLink, currentView === 'Search' && styles.sideLinkActive]} onPress={() => setCurrentView('Search')}><Text style={styles.sideLinkText}>Search</Text></TouchableOpacity>
              <TouchableOpacity style={[styles.sideLink, currentView === 'Profile' && styles.sideLinkActive]} onPress={() => setCurrentView('Profile')}><Text style={styles.sideLinkText}>Profile</Text></TouchableOpacity>
            </View>
            <View style={{ flex: 1 }} />
            <TouchableOpacity style={styles.sidePostBtn} onPress={() => setIsComposeVisible(true)}><Text style={styles.btnText}>+ New Post</Text></TouchableOpacity>
          </View>
        )}

        <View style={styles.workspace}>
          
          {/* COMMENT SHEET INTERFACE */}
          <Modal visible={isCommentModalVisible} animationType="slide">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIsCommentModalVisible(false)}><Text style={styles.goldActionText}>Close</Text></TouchableOpacity>
                <Text style={styles.sheetTitle}>RESPONSES</Text>
                <View style={{ width: 40 }} />
              </View>
              <ScrollView style={{ padding: 16, flex: 1 }}>
                <Text style={styles.greyText}>Comments and analytical reviews appear here.</Text>
              </ScrollView>
            </SafeAreaView>
          </Modal>

          {/* COMPOSE REPOSITORY POST MODAL */}
          <Modal visible={isComposeVisible} animationType="slide">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIsComposeVisible(false)}><Text style={styles.goldActionText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.greenActionBtn} onPress={handlePublishPost}><Text style={styles.btnText}>Publish</Text></TouchableOpacity>
              </View>
              <View style={styles.composeInputLayout}>
                {renderAvatar(userProfile.avatar, userProfile.name, styles.avatarMini)}
                <TextInput style={styles.inputArea} placeholder="Log your route update..." placeholderTextColor="#8E8E8A" multiline autoFocus value={newPostText} onChangeText={setNewPostText} />
              </View>
              {attachedMedia && (
                <View style={styles.mediaContainer}>
                  <Image source={{ uri: attachedMedia }} style={styles.imgPreview} />
                  <TouchableOpacity style={styles.removeMediaBtn} onPress={() => setAttachedMedia(null)}><Text style={styles.btnText}>✕ Remove</Text></TouchableOpacity>
                </View>
              )}
              <TouchableOpacity style={styles.mediaTray} onPress={pickImage}><Text style={styles.mediaTrayText}>🖼️ Attach Local System Image</Text></TouchableOpacity>
            </SafeAreaView>
          </Modal>

          {/* EDIT CONTAINER CONFIGURATION MODAL */}
          <Modal visible={isEditProfileVisible} animationType="fade">
            <SafeAreaView style={styles.sheet}>
              <View style={styles.sheetHeader}>
                <TouchableOpacity onPress={() => setIsEditProfileVisible(false)}><Text style={styles.goldActionText}>Cancel</Text></TouchableOpacity>
                <TouchableOpacity style={styles.greenActionBtn} onPress={saveProfileChanges}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
              </View>
              <View style={{ padding: 20 }}>
                <Text style={styles.label}>IDENTIFICATION HANDLE</Text>
                <TextInput style={styles.field} value={inputName} onChangeText={setInputName} placeholderTextColor="#8E8E8A" />
                <Text style={styles.label}>METADATA DESCRIPTION</Text>
                <TextInput style={[styles.field, { height: 80 }]} value={inputBio} onChangeText={setInputBio} placeholderTextColor="#8E8E8A" multiline />
              </View>
            </SafeAreaView>
          </Modal>

          {/* APP MASTER SYSTEM FEED VIEW */}
          {currentView === 'Feed' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}>
                <Text style={styles.logo}>TO <Text style={{color: '#FFD700'}}>PLACES</Text></Text>
                {!isDesktop && (
                  <TouchableOpacity style={styles.greenActionBtn} onPress={() => setIsComposeVisible(true)}><Text style={styles.btnText}>+ Post</Text></TouchableOpacity>
                )}
              </View>
              <View style={styles.tabs}>
                <TouchableOpacity style={[styles.tab, activeTab === 'Logs' && styles.tabActive]} onPress={() => setActiveTab('Logs')}><Text style={[styles.tabText, activeTab === 'Logs' && styles.tabTextActive]}>Logs</Text></TouchableOpacity>
                <TouchableOpacity style={[styles.tab, activeTab === 'Gallery' && styles.tabActive]} onPress={() => setActiveTab('Gallery')}><Text style={[styles.tabText, activeTab === 'Gallery' && styles.tabTextActive]}>Media</Text></TouchableOpacity>
              </View>
              
              {feedLoading ? (
                <View style={styles.center}><ActivityIndicator size="large" color="#FFD700" /></View>
              ) : (
                <ScrollView style={{ flex: 1 }}>
                  {logs.map(log => (
                    <View key={log.id} style={styles.postCard}>
                      <View style={styles.postHeader}>
                        {renderAvatar(log.avatar, log.user)}
                        <View style={{ marginLeft: 10 }}>
                          <Text style={styles.whiteBold}>{log.user}</Text>
                          <Text style={styles.greyText}>{log.handle}</Text>
                        </View>
                      </View>
                      <Text style={styles.contentText}>{log.content}</Text>
                      {log.media && <Image source={{ uri: log.media }} style={styles.postMedia} resizeMode="cover" />}
                      
                      <View style={styles.actionRow}>
                        <TouchableOpacity><Text style={styles.actionLink}>🖤 Like</Text></TouchableOpacity>
                        <TouchableOpacity onPress={() => { setActiveCommentLogId(log.id); setIsCommentModalVisible(true); }}><Text style={styles.actionLink}>💬 Reply</Text></TouchableOpacity>
                        
                        {/* SECURE IDENTITY CHECKED DELETION FLOW ENGINE */}
                        {log.userId === session.user.id && (
                          <TouchableOpacity onPress={() => handleDeletePost(log.id)}>
                            <Text style={[styles.actionLink, { color: '#FF5A5F', fontWeight: '700' }]}>🗑️ Delete</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          {/* SEARCH SYSTEM ENGINE MODULE */}
          {currentView === 'Search' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}><Text style={styles.logo}>EXPLORE <Text style={{color: '#FFD700'}}>ENGINE</Text></Text></View>
              <TextInput style={styles.searchBar} placeholder="Filter index parameters..." placeholderTextColor="#8E8E8A" value={searchQuery} onChangeText={setSearchQuery} />
            </View>
          )}

          {/* REPOSITORY USER PROFILE HUB */}
          {currentView === 'Profile' && (
            <View style={{ flex: 1 }}>
              <View style={styles.appBar}>
                <Text style={styles.logo}>MY <Text style={{color: '#FFD700'}}>PROFILE</Text></Text>
                <TouchableOpacity style={styles.logOutBtn} onPress={handleSignOut}><Text style={styles.redText}>Log Out</Text></TouchableOpacity>
              </View>
              <View style={styles.profileHub}>
                {renderAvatar(userProfile.avatar, userProfile.name, styles.avatarLarge)}
                <Text style={[styles.whiteBold, { fontSize: 20, marginTop: 12 }]}>{userProfile.name}</Text>
                <Text style={styles.greyText}>{userProfile.handle}</Text>
                <Text style={styles.bioText}>{userProfile.bio}</Text>
                <TouchableOpacity style={styles.editBtn} onPress={() => setIsEditProfileVisible(true)}><Text style={styles.whiteBold}>Configure Profile</Text></TouchableOpacity>
              </View>
            </View>
          )}

          {/* BOTTOM TRAY CONTROLS FOR DIRECT PHONE VIEWPORT */}
          {!isDesktop && (
            <View style={styles.bottomNav}>
              <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Feed')}><Text style={[styles.navText, currentView === 'Feed' && { color: '#FFD700' }]}>Feed</Text></TouchableOpacity>
              <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Search')}><Text style={[styles.navText, currentView === 'Search' && { color: '#FFD700' }]}>Search</Text></TouchableOpacity>
              <TouchableOpacity style={styles.navBtn} onPress={() => setCurrentView('Profile')}><Text style={[styles.navText, currentView === 'Profile' && { color: '#FFD700' }]}>Profile</Text></TouchableOpacity>
            </View>
          )}

        </View>
      </View>
    </SafeAreaView>
  );
}

// --- SECURE SOLID MATRIX COLORS (GREEN, RED, GOLD, GREY) ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0D0D0C' },
  workspace: { flex: 1, backgroundColor: '#0D0D0C' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  
  sidebar: { width: 260, backgroundColor: '#1A1A18', borderRightWidth: 1, borderRightColor: '#262624', padding: 20 },
  sideLink: { width: '100%', padding: 12, borderRadius: 8, marginVertical: 4 },
  sideLinkActive: { backgroundColor: '#262624' },
  sideLinkText: { color: '#FFFFFF', fontWeight: '700' },
  sidePostBtn: { backgroundColor: '#00B074', padding: 12, borderRadius: 20, alignItems: 'center' },

  appBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#262624' },
  logo: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 1 },
  greenActionBtn: { backgroundColor: '#00B074', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 },
  btnText: { color: '#FFFFFF', fontWeight: '700' },
  goldActionText: { color: '#FFD700', fontWeight: '700' },
  redText: { color: '#FF5A5F', fontWeight: '700' },
  whiteBold: { color: '#FFFFFF', fontWeight: '700' },
  greyText: { color: '#8E8E8A', fontSize: 13 },

  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: '#262624' },
  tab: { flex: 1, alignItems: 'center', padding: 14 },
  tabActive: { borderBottomWidth: 2, borderBottomColor: '#FFD700' },
  tabText: { color: '#8E8E8A', fontWeight: '600' },
  tabTextActive: { color: '#FFFFFF' },

  postCard: { backgroundColor: '#1A1A18', padding: 16, marginVertical: 6, marginHorizontal: 12, borderRadius: 12, borderWidth: 1, borderColor: '#262624' },
  postHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  contentText: { color: '#E6E6E6', fontSize: 15, lineHeight: 22 },
  postMedia: { width: '100%', height: 200, borderRadius: 8, marginTop: 12 },
  actionRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, borderTopWidth: 1, borderTopColor: '#262624', paddingTop: 10 },
  actionLink: { color: '#8E8E8A', fontSize: 13, fontWeight: '600' },

  avatarMini: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#262624' },
  avatarLarge: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#262624', borderWidth: 2, borderColor: '#FFD700' },
  avatarFallback: { backgroundColor: '#3A3A36', alignItems: 'center', justifyContent: 'center' },
  avatarFallbackText: { color: '#FFD700', fontWeight: '900' },

  sheet: { flex: 1, backgroundColor: '#0D0D0C' },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#262624', alignItems: 'center' },
  sheetTitle: { color: '#FFFFFF', fontWeight: '700' },
  composeInputLayout: { flexDirection: 'row', padding: 16 },
  inputArea: { flex: 1, color: '#FFFFFF', paddingLeft: 12, fontSize: 16, textAlignVertical: 'top' },
  mediaTray: { padding: 16, alignItems: 'center', borderTopWidth: 1, borderTopColor: '#262624' },
  mediaTrayText: { color: '#00B074', fontWeight: '700' },
  mediaContainer: { position: 'relative', margin: 16, height: 200 },
  imgPreview: { width: '100%', height: '100%', borderRadius: 8 },
  removeMediaBtn: { position: 'absolute', top: 10, right: 10, backgroundColor: '#FF5A5F', padding: 8, borderRadius: 12 },

  profileHub: { backgroundColor: '#1A1A18', padding: 20, margin: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#262624' },
  bioText: { color: '#E6E6E6', textAlign: 'center', marginVertical: 12 },
  editBtn: { backgroundColor: '#262624', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 6 },
  logOutBtn: { padding: 6, backgroundColor: '#262624', borderRadius: 6 },
  label: { color: '#FFD700', fontSize: 11, fontWeight: '800', marginTop: 12 },
  field: { backgroundColor: '#1A1A18', color: '#FFFFFF', padding: 12, borderRadius: 8, marginTop: 6, borderWidth: 1, borderColor: '#262624' },
  searchBar: { backgroundColor: '#1A1A18', color: '#FFFFFF', padding: 12, margin: 12, borderRadius: 8, borderWidth: 1, borderColor: '#262624' },

  bottomNav: { flexDirection: 'row', height: 60, borderTopWidth: 1, borderTopColor: '#262624', backgroundColor: '#0D0D0C' },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  navText: { color: '#8E8E8A', fontWeight: '700', fontSize: 12 }
});
